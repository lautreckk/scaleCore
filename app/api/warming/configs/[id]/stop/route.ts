import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/warming/configs/[id]/stop - Stop warming session
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

  // Stop all active sessions
  const { data: sessions, error: sessionError } = await supabase
    .from("warming_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("warming_config_id", id)
    .in("status", ["running", "paused"])
    .select();

  if (sessionError) {
    console.error("Error stopping sessions:", sessionError);
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  // Update config status
  await supabase
    .from("warming_configs")
    .update({ status: "inactive" })
    .eq("id", id);

  // Complete any active conversations
  await supabase
    .from("warming_conversations")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("warming_config_id", id)
    .eq("status", "active");

  return NextResponse.json({
    data: { sessions_stopped: sessions?.length || 0 },
  });
}
