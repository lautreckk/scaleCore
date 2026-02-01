import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/warming/media/[id] - Get single media item
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

  const { data: media, error } = await supabase
    .from("warming_media")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  return NextResponse.json({ data: media });
}

// PATCH /api/warming/media/[id] - Update media item
export async function PATCH(
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
  const { name, is_active } = body;

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updateData.name = name;
  if (is_active !== undefined) updateData.is_active = is_active;

  const { data: media, error } = await supabase
    .from("warming_media")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating warming media:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: media });
}

// DELETE /api/warming/media/[id] - Delete media item
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

  // Get media to delete file from storage
  const { data: media } = await supabase
    .from("warming_media")
    .select("file_path")
    .eq("id", id)
    .single();

  if (media?.file_path) {
    // Delete from storage
    await supabase.storage
      .from("warming-media")
      .remove([media.file_path]);
  }

  // Delete from database
  const { error } = await supabase
    .from("warming_media")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting warming media:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
