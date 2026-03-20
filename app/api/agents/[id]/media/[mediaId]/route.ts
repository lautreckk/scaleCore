import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/agents/[id]/media/[mediaId] - Update media name/description
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const { id: agentId, mediaId } = await params;
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

  // Verify agent ownership
  const { data: agent } = await supabase
    .from("ai_agents")
    .select("id")
    .eq("id", agentId)
    .eq("tenant_id", tenantUser.tenant_id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, description } = body;

  // Validate: name must be non-empty string if provided
  if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
    return NextResponse.json(
      { error: "Nome e obrigatorio" },
      { status: 400 }
    );
  }

  const updateFields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (name !== undefined) updateFields.name = name;
  if (description !== undefined) updateFields.description = description;

  const { data, error } = await supabase
    .from("ai_agent_media")
    .update(updateFields)
    .eq("id", mediaId)
    .eq("agent_id", agentId)
    .select()
    .single();

  if (error) {
    console.error("Error updating media:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}

// DELETE /api/agents/[id]/media/[mediaId] - Delete media
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const { id: agentId, mediaId } = await params;
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

  // Verify agent ownership
  const { data: agent } = await supabase
    .from("ai_agents")
    .select("id")
    .eq("id", agentId)
    .eq("tenant_id", tenantUser.tenant_id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Fetch media record to get file_url for storage cleanup
  const { data: mediaRecord } = await supabase
    .from("ai_agent_media")
    .select("file_url")
    .eq("id", mediaId)
    .eq("agent_id", agentId)
    .single();

  if (!mediaRecord) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  // Delete from table
  const { error: deleteError } = await supabase
    .from("ai_agent_media")
    .delete()
    .eq("id", mediaId)
    .eq("agent_id", agentId);

  if (deleteError) {
    console.error("Error deleting media:", deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Delete from storage - extract path from public URL
  try {
    const url = new URL(mediaRecord.file_url);
    // Public URL format: .../storage/v1/object/public/chat-media/agent-media/...
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/chat-media\/(.+)/);
    if (pathMatch) {
      await supabase.storage.from("chat-media").remove([pathMatch[1]]);
    }
  } catch (storageError) {
    // Log but don't fail the request if storage cleanup fails
    console.error("Storage cleanup error:", storageError);
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
