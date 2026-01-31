import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/warming/configs/[id]/pause - Pause or resume warming session
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

  // Get current session
  const { data: session, error: fetchError } = await supabase
    .from("warming_sessions")
    .select("*")
    .eq("warming_config_id", id)
    .in("status", ["running", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (fetchError || !session) {
    return NextResponse.json(
      { error: "No active session found" },
      { status: 404 }
    );
  }

  const isPaused = session.status === "paused";

  if (isPaused) {
    // Resume session
    const { data: config } = await supabase
      .from("warming_configs")
      .select("min_delay_between_actions, max_delay_between_actions")
      .eq("id", id)
      .single();

    const minDelay = config?.min_delay_between_actions || 60;
    const maxDelay = config?.max_delay_between_actions || 300;
    const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    const nextActionAt = new Date(Date.now() + randomDelay * 1000);

    const { data: updatedSession, error: updateError } = await supabase
      .from("warming_sessions")
      .update({
        status: "running",
        paused_at: null,
        next_action_at: nextActionAt.toISOString(),
      })
      .eq("id", session.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update config status
    await supabase
      .from("warming_configs")
      .update({ status: "active" })
      .eq("id", id);

    return NextResponse.json({
      data: updatedSession,
      message: "Session resumed",
    });
  } else {
    // Pause session
    const { data: updatedSession, error: updateError } = await supabase
      .from("warming_sessions")
      .update({
        status: "paused",
        paused_at: new Date().toISOString(),
        next_action_at: null,
      })
      .eq("id", session.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update config status
    await supabase
      .from("warming_configs")
      .update({ status: "paused" })
      .eq("id", id);

    return NextResponse.json({
      data: updatedSession,
      message: "Session paused",
    });
  }
}
