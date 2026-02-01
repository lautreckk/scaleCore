import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/warming/configs/[id] - Get config details
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

  const { data: config, error } = await supabase
    .from("warming_configs")
    .select(`
      *,
      warming_config_instances (
        id,
        instance_id,
        is_active,
        messages_sent_today,
        audio_sent_today,
        media_sent_today,
        status_posted_today,
        reactions_sent_today,
        counters_reset_date,
        last_action_at,
        whatsapp_instances:instance_id (
          id,
          name,
          phone_number,
          color,
          status
        )
      ),
      warming_sessions (
        id,
        status,
        started_at,
        paused_at,
        completed_at,
        actions_executed,
        errors_count,
        last_error,
        next_action_at,
        next_action_type
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching config:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!config) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  // Get active session
  const activeSession = config.warming_sessions
    ?.filter((s: { status: string }) => s.status === "running" || s.status === "paused")
    .sort((a: { started_at: string }, b: { started_at: string }) =>
      new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    )[0];

  return NextResponse.json({
    data: {
      ...config,
      active_session: activeSession || null,
    },
  });
}

// PUT /api/warming/configs/[id] - Update config
export async function PUT(
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

  const body = await request.json();
  const { instance_ids } = body;

  // Only allow valid config fields to be updated
  const validFields = [
    "name", "description", "status", "run_24h", "start_time", "end_time",
    "days_of_week", "timezone", "text_messages_enabled", "text_messages_weight",
    "audio_messages_enabled", "audio_messages_weight", "image_messages_enabled",
    "image_messages_weight", "document_messages_enabled", "document_messages_weight",
    "video_messages_enabled", "video_messages_weight", "status_posts_enabled",
    "status_posts_weight", "status_views_enabled", "status_views_weight",
    "reactions_enabled", "reactions_weight", "min_delay_between_actions",
    "max_delay_between_actions", "min_typing_duration", "max_typing_duration",
    "max_messages_per_day", "max_audio_per_day", "max_media_per_day",
    "max_status_per_day", "max_reactions_per_day", "use_ai_conversations",
    "ai_topics", "ai_tone", "ai_language"
  ];

  const configData: Record<string, unknown> = {};
  for (const field of validFields) {
    if (field in body) {
      configData[field] = body[field];
    }
  }

  // Update config
  const { data: config, error: configError } = await supabase
    .from("warming_configs")
    .update({
      ...configData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (configError) {
    console.error("Error updating config:", configError);
    return NextResponse.json({ error: configError.message }, { status: 500 });
  }

  // Update instances if provided
  if (instance_ids && Array.isArray(instance_ids)) {
    // Get current instances
    const { data: currentInstances } = await supabase
      .from("warming_config_instances")
      .select("instance_id")
      .eq("warming_config_id", id);

    const currentIds = currentInstances?.map((i) => i.instance_id) || [];
    const newIds = instance_ids as string[];

    // Remove instances not in new list
    const toRemove = currentIds.filter((cid) => !newIds.includes(cid));
    if (toRemove.length > 0) {
      await supabase
        .from("warming_config_instances")
        .delete()
        .eq("warming_config_id", id)
        .in("instance_id", toRemove);
    }

    // Add new instances
    const toAdd = newIds.filter((nid) => !currentIds.includes(nid));
    if (toAdd.length > 0) {
      const instanceInserts = toAdd.map((instanceId) => ({
        warming_config_id: id,
        instance_id: instanceId,
        is_active: true,
      }));
      await supabase.from("warming_config_instances").insert(instanceInserts);
    }
  }

  return NextResponse.json({ data: config });
}

// DELETE /api/warming/configs/[id] - Delete config
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

  // Stop any active session first
  await supabase
    .from("warming_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("warming_config_id", id)
    .in("status", ["running", "paused"]);

  // Delete config (cascades to instances, sessions, etc.)
  const { error } = await supabase
    .from("warming_configs")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting config:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
