import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { agentFormSchema } from "@/lib/agents/validation";

// GET /api/agents/[id] - Get single agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const { data: agent, error } = await supabase
    .from("ai_agents")
    .select(
      "*, ai_agent_instances(*, whatsapp_instances:instance_id(id, name, phone_number, status))"
    )
    .eq("id", id)
    .eq("tenant_id", tenantUser.tenant_id)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({ data: agent });
}

// PATCH /api/agents/[id] - Update agent
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  // Validate partial fields
  const partialSchema = agentFormSchema.partial();
  let validated;
  try {
    validated = partialSchema.parse(body);
  } catch (err: unknown) {
    const message =
      err && typeof err === "object" && "errors" in err
        ? (err as { errors: unknown }).errors
        : "Validation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { instance_ids, ...updateFields } = validated;

  // Update agent fields
  if (Object.keys(updateFields).length > 0) {
    const { error: updateError } = await supabase
      .from("ai_agents")
      .update({
        ...updateFields,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id);

    if (updateError) {
      if (updateError.code === "23505") {
        return NextResponse.json(
          {
            error:
              "Essa tag ja esta sendo usada por outro agente. Escolha uma tag diferente.",
          },
          { status: 409 }
        );
      }
      console.error("Error updating agent:", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }
  }

  // Replace instance bindings if provided
  if (instance_ids !== undefined) {
    // Delete all existing bindings
    await supabase
      .from("ai_agent_instances")
      .delete()
      .eq("agent_id", id);

    // Insert new bindings
    if (instance_ids.length > 0) {
      const instanceInserts = instance_ids.map((instanceId) => ({
        agent_id: id,
        instance_id: instanceId,
      }));

      const { error: instanceError } = await supabase
        .from("ai_agent_instances")
        .insert(instanceInserts);

      if (instanceError) {
        console.error("Error updating instances:", instanceError);
        return NextResponse.json(
          { error: instanceError.message },
          { status: 500 }
        );
      }
    }
  }

  // Fetch and return updated agent
  const { data: updatedAgent } = await supabase
    .from("ai_agents")
    .select(
      "*, ai_agent_instances(*, whatsapp_instances:instance_id(id, name, phone_number, status))"
    )
    .eq("id", id)
    .eq("tenant_id", tenantUser.tenant_id)
    .single();

  return NextResponse.json({ data: updatedAgent });
}

// DELETE /api/agents/[id] - Delete agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  // Delete agent (junction table rows cascade-deleted automatically)
  const { error } = await supabase
    .from("ai_agents")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantUser.tenant_id);

  if (error) {
    console.error("Error deleting agent:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
