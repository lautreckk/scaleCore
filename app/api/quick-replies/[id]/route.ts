import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/quick-replies/[id] - Get a quick reply by ID
export async function GET(
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

    const { data: quickReply, error } = await supabase
      .from("quick_replies")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Quick reply not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(quickReply);
  } catch (error) {
    console.error("Error fetching quick reply:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/quick-replies/[id] - Update a quick reply
export async function PATCH(
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

    // Verify quick reply belongs to tenant
    const { data: existing } = await supabase
      .from("quick_replies")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Quick reply not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      shortcut,
      category,
      message_type,
      content,
      media_url,
      media_mimetype,
      file_name,
      is_active,
      position,
    } = body;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (shortcut !== undefined) updateData.shortcut = shortcut || null;
    if (category !== undefined) updateData.category = category || null;
    if (message_type !== undefined) updateData.message_type = message_type;
    if (content !== undefined) updateData.content = content || null;
    if (media_url !== undefined) updateData.media_url = media_url || null;
    if (media_mimetype !== undefined) updateData.media_mimetype = media_mimetype || null;
    if (file_name !== undefined) updateData.file_name = file_name || null;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (position !== undefined) updateData.position = position;

    const { data: quickReply, error } = await supabase
      .from("quick_replies")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(quickReply);
  } catch (error) {
    console.error("Error updating quick reply:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/quick-replies/[id] - Delete a quick reply
export async function DELETE(
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

    // Verify quick reply belongs to tenant
    const { data: existing } = await supabase
      .from("quick_replies")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Quick reply not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("quick_replies")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quick reply:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
