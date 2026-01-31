import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/quick-replies/[id]/use - Increment usage count
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: { user } } = await supabase.auth.getUser();
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

    // Verify quick reply belongs to tenant and increment usage
    const { data: quickReply, error } = await supabase
      .from("quick_replies")
      .select("id, usage_count")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!quickReply) {
      return NextResponse.json({ error: "Quick reply not found" }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from("quick_replies")
      .update({
        usage_count: (quickReply.usage_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error incrementing usage count:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
