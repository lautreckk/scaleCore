import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/quick-replies - List quick replies
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const active = searchParams.get("active");

    let query = supabase
      .from("quick_replies")
      .select("*")
      .eq("tenant_id", tenantUser.tenant_id)
      .order("usage_count", { ascending: false })
      .order("position", { ascending: true });

    if (category) {
      query = query.eq("category", category);
    }

    if (active !== null) {
      query = query.eq("is_active", active === "true");
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,shortcut.ilike.%${search}%,content.ilike.%${search}%`);
    }

    const { data: quickReplies, error } = await query;

    if (error) throw error;

    return NextResponse.json(quickReplies);
  } catch (error) {
    console.error("Error fetching quick replies:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/quick-replies - Create a new quick reply
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      shortcut,
      category,
      message_type = "text",
      content,
      media_url,
      media_mimetype,
      file_name,
      is_active = true,
      position = 0,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (message_type === "text" && !content) {
      return NextResponse.json(
        { error: "Content is required for text messages" },
        { status: 400 }
      );
    }

    if (message_type !== "text" && !media_url) {
      return NextResponse.json(
        { error: "Media URL is required for media messages" },
        { status: 400 }
      );
    }

    const { data: quickReply, error } = await supabase
      .from("quick_replies")
      .insert({
        tenant_id: tenantUser.tenant_id,
        name,
        shortcut: shortcut || null,
        category: category || null,
        message_type,
        content: content || null,
        media_url: media_url || null,
        media_mimetype: media_mimetype || null,
        file_name: file_name || null,
        is_active,
        position,
        created_by: tenantUser.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(quickReply);
  } catch (error) {
    console.error("Error creating quick reply:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
