import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/warming/configs/[id]/start - Start warming session
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

  // Get config with tenant
  const { data: config, error: configError } = await supabase
    .from("warming_configs")
    .select("*, warming_config_instances(id)")
    .eq("id", id)
    .single();

  if (configError || !config) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  // Check if there's already a running session
  const { data: existingSession } = await supabase
    .from("warming_sessions")
    .select("id")
    .eq("warming_config_id", id)
    .in("status", ["running", "paused"])
    .single();

  if (existingSession) {
    return NextResponse.json(
      { error: "A session is already running" },
      { status: 400 }
    );
  }

  // Check minimum instances
  if (!config.warming_config_instances || config.warming_config_instances.length < 2) {
    return NextResponse.json(
      { error: "At least 2 instances are required" },
      { status: 400 }
    );
  }

  // Calculate next action time
  const minDelay = config.min_delay_between_actions || 60;
  const maxDelay = config.max_delay_between_actions || 300;
  const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  const nextActionAt = new Date(Date.now() + randomDelay * 1000);

  // Create new session
  const { data: session, error: sessionError } = await supabase
    .from("warming_sessions")
    .insert({
      warming_config_id: id,
      tenant_id: config.tenant_id,
      status: "running",
      next_action_at: nextActionAt.toISOString(),
    })
    .select()
    .single();

  if (sessionError) {
    console.error("Error creating session:", sessionError);
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  // Update config status
  await supabase
    .from("warming_configs")
    .update({ status: "active" })
    .eq("id", id);

  // Reset daily counters if needed
  const today = new Date().toISOString().split("T")[0];
  await supabase
    .from("warming_config_instances")
    .update({
      messages_sent_today: 0,
      audio_sent_today: 0,
      media_sent_today: 0,
      status_posted_today: 0,
      reactions_sent_today: 0,
      counters_reset_date: today,
    })
    .eq("warming_config_id", id)
    .neq("counters_reset_date", today);

  return NextResponse.json({ data: session }, { status: 201 });
}
