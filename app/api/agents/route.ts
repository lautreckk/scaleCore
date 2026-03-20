import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { agentFormSchema } from "@/lib/agents/validation";

// GET /api/agents - List all agents for tenant
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!tenantUser) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { data: agents, error } = await supabase
    .from("ai_agents")
    .select(
      "*, ai_agent_instances(*, whatsapp_instances:instance_id(id, name, phone_number, status))"
    )
    .eq("tenant_id", tenantUser.tenant_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: agents });
}

// POST /api/agents - Create new agent
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!tenantUser) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let validated;
  try {
    validated = agentFormSchema.parse(body);
  } catch (err: unknown) {
    const message =
      err && typeof err === "object" && "errors" in err
        ? (err as { errors: unknown }).errors
        : "Validation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { instance_ids, ...agentData } = validated;

  // Insert agent
  const { data: newAgent, error: agentError } = await supabase
    .from("ai_agents")
    .insert({
      ...agentData,
      tenant_id: tenantUser.tenant_id,
    })
    .select()
    .single();

  if (agentError) {
    // Handle unique constraint violation on activation_tag per tenant
    if (agentError.code === "23505") {
      return NextResponse.json(
        {
          error:
            "Essa tag ja esta sendo usada por outro agente. Escolha uma tag diferente.",
        },
        { status: 409 }
      );
    }
    console.error("Error creating agent:", agentError);
    return NextResponse.json({ error: agentError.message }, { status: 500 });
  }

  // Insert instance bindings if provided
  if (instance_ids && instance_ids.length > 0) {
    const instanceInserts = instance_ids.map((instanceId) => ({
      agent_id: newAgent.id,
      instance_id: instanceId,
    }));

    const { error: instanceError } = await supabase
      .from("ai_agent_instances")
      .insert(instanceInserts);

    if (instanceError) {
      console.error("Error adding instances:", instanceError);
      // Rollback agent creation
      await supabase.from("ai_agents").delete().eq("id", newAgent.id);
      return NextResponse.json(
        { error: instanceError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ data: newAgent }, { status: 201 });
}
