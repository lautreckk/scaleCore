import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/warming/stats - Get warming statistics
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
  const period = searchParams.get("period") || "today"; // today, week, month

  // Calculate date range
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case "week":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default: // today
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // Build query
  let logsQuery = supabase
    .from("warming_action_logs")
    .select("action_type, status, ai_generated, ai_tokens_used, ai_cost_cents")
    .eq("tenant_id", tenantUser.tenant_id)
    .gte("executed_at", startDate.toISOString());

  if (configId) {
    logsQuery = logsQuery.eq("warming_config_id", configId);
  }

  const { data: logs, error: logsError } = await logsQuery;

  if (logsError) {
    console.error("Error fetching stats:", logsError);
    return NextResponse.json({ error: logsError.message }, { status: 500 });
  }

  // Calculate statistics
  const stats = {
    total_actions: logs?.length || 0,
    successful_actions: logs?.filter((l) => l.status === "success").length || 0,
    failed_actions: logs?.filter((l) => l.status === "failed").length || 0,
    actions_by_type: {} as Record<string, number>,
    ai_generated_count: logs?.filter((l) => l.ai_generated).length || 0,
    ai_tokens_used: logs?.reduce((sum, l) => sum + (l.ai_tokens_used || 0), 0) || 0,
    ai_cost_cents: logs?.reduce((sum, l) => sum + (l.ai_cost_cents || 0), 0) || 0,
  };

  // Count by action type
  logs?.forEach((log) => {
    stats.actions_by_type[log.action_type] =
      (stats.actions_by_type[log.action_type] || 0) + 1;
  });

  // Get active configs count
  const { count: activeConfigs } = await supabase
    .from("warming_configs")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantUser.tenant_id)
    .eq("status", "active");

  // Get running sessions count
  const { count: runningSessions } = await supabase
    .from("warming_sessions")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantUser.tenant_id)
    .eq("status", "running");

  return NextResponse.json({
    data: {
      ...stats,
      active_configs: activeConfigs || 0,
      running_sessions: runningSessions || 0,
      period,
      start_date: startDate.toISOString(),
    },
  });
}
