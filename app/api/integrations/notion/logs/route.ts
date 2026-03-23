import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/integrations/notion/logs — return last 20 sync logs
export async function GET() {
  try {
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

    const { data: logs, error } = await supabase
      .from("notion_sync_log")
      .select("*")
      .eq("tenant_id", tenantUser.tenant_id)
      .order("started_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({ logs: logs ?? [] });
  } catch (error) {
    console.error("Error fetching Notion sync logs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
