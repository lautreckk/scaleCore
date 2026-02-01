import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/warming/media - List all warming media for tenant
export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  let query = supabase
    .from("warming_media")
    .select("*")
    .eq("tenant_id", tenantUser.tenant_id)
    .order("created_at", { ascending: false });

  if (type) {
    query = query.eq("type", type);
  }

  const { data: media, error } = await query;

  if (error) {
    console.error("Error fetching warming media:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: media });
}

// POST /api/warming/media - Create new warming media entry
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("id, tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!tenantUser) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const body = await request.json();
  const { type, name, file_path, file_url, file_size, mime_type, duration_seconds } = body;

  if (!type || !name || !file_path || !file_url || !file_size) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const validTypes = ["audio", "image", "document", "video"];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: "Invalid media type" },
      { status: 400 }
    );
  }

  const { data: media, error } = await supabase
    .from("warming_media")
    .insert({
      tenant_id: tenantUser.tenant_id,
      type,
      name,
      file_path,
      file_url,
      file_size,
      mime_type,
      duration_seconds,
      created_by: tenantUser.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating warming media:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: media }, { status: 201 });
}
