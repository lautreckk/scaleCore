import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/warming/logs - Get warming action logs
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get tenant
  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!tenantUser) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const configId = searchParams.get("config_id");
  const sessionId = searchParams.get("session_id");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  let query = supabase
    .from("warming_action_logs")
    .select(`
      *,
      from_instance:from_instance_id (id, name, color),
      to_instance:to_instance_id (id, name, color),
      warming_configs:warming_config_id (id, name)
    `, { count: "exact" })
    .eq("tenant_id", tenantUser.tenant_id)
    .order("executed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (configId) {
    query = query.eq("warming_config_id", configId);
  }

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  const { data: logs, count, error } = await query;

  if (error) {
    console.error("Error fetching logs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: logs,
    pagination: {
      total: count || 0,
      limit,
      offset,
    },
  });
}
