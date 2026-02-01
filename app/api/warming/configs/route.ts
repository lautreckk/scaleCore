import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/warming/configs - List all warming configs for tenant
export async function GET() {
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

  // Get configs with instances and active session
  const { data: configs, error } = await supabase
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
        actions_executed,
        errors_count,
        next_action_at
      )
    `)
    .eq("tenant_id", tenantUser.tenant_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching warming configs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get only the latest session for each config
  const configsWithLatestSession = configs?.map((config) => {
    const latestSession = config.warming_sessions
      ?.filter((s: { status: string }) => s.status === "running" || s.status === "paused")
      .sort((a: { started_at: string }, b: { started_at: string }) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      )[0];

    return {
      ...config,
      active_session: latestSession || null,
      warming_sessions: undefined,
    };
  });

  return NextResponse.json({ data: configsWithLatestSession });
}

// POST /api/warming/configs - Create new warming config
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get tenant user
  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("id, tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!tenantUser) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const body = await request.json();
  const { instance_ids } = body;

  // Only allow valid config fields
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

  // Validate required fields
  if (!configData.name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!instance_ids || instance_ids.length < 2) {
    return NextResponse.json(
      { error: "At least 2 instances are required" },
      { status: 400 }
    );
  }

  // Create config
  const { data: config, error: configError } = await supabase
    .from("warming_configs")
    .insert({
      ...configData,
      tenant_id: tenantUser.tenant_id,
      created_by: tenantUser.id,
    })
    .select()
    .single();

  if (configError) {
    console.error("Error creating warming config:", configError);
    return NextResponse.json({ error: configError.message }, { status: 500 });
  }

  // Add instances
  const instanceInserts = instance_ids.map((instanceId: string) => ({
    warming_config_id: config.id,
    instance_id: instanceId,
    is_active: true,
  }));

  const { error: instanceError } = await supabase
    .from("warming_config_instances")
    .insert(instanceInserts);

  if (instanceError) {
    console.error("Error adding instances:", instanceError);
    // Rollback config creation
    await supabase.from("warming_configs").delete().eq("id", config.id);
    return NextResponse.json({ error: instanceError.message }, { status: 500 });
  }

  return NextResponse.json({ data: config }, { status: 201 });
}
