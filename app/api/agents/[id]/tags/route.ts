import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/agents/[id]/tags - Get count of chats that would be affected by bulk tag application
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

  // Get agent with its instances
  const { data: agent, error: agentError } = await supabase
    .from("ai_agents")
    .select("activation_tag, ai_agent_instances(instance_id)")
    .eq("id", id)
    .eq("tenant_id", tenantUser.tenant_id)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const instanceIds = (
    agent.ai_agent_instances as Array<{ instance_id: string }>
  ).map((ai) => ai.instance_id);

  if (instanceIds.length === 0) {
    return NextResponse.json({ count: 0 });
  }

  // Count chats that don't already have the tag
  const { count, error: countError } = await supabase
    .from("chats")
    .select("id", { count: "exact", head: true })
    .in("instance_id", instanceIds)
    .not("tags", "cs", `{${agent.activation_tag}}`);

  if (countError) {
    console.error("Error counting chats:", countError);
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0 });
}

// POST /api/agents/[id]/tags - Bulk apply tag to existing chats
export async function POST(
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

  // Get agent with its instances
  const { data: agent, error: agentError } = await supabase
    .from("ai_agents")
    .select("activation_tag, ai_agent_instances(instance_id)")
    .eq("id", id)
    .eq("tenant_id", tenantUser.tenant_id)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const instanceIds = (
    agent.ai_agent_instances as Array<{ instance_id: string }>
  ).map((ai) => ai.instance_id);

  if (instanceIds.length === 0) {
    return NextResponse.json({ affected: 0 });
  }

  // Count affected chats first
  const { count } = await supabase
    .from("chats")
    .select("id", { count: "exact", head: true })
    .in("instance_id", instanceIds)
    .not("tags", "cs", `{${agent.activation_tag}}`);

  // Apply tag via RPC function
  const { error: rpcError } = await supabase.rpc("apply_agent_tag", {
    p_instance_ids: instanceIds,
    p_tag: agent.activation_tag,
  });

  if (rpcError) {
    console.error("Error applying tags:", rpcError);
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  return NextResponse.json({ affected: count ?? 0 });
}
