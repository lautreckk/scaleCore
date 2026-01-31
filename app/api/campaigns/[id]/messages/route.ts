import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List all messages for a campaign
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify campaign ownership
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Get messages ordered by position
    const { data: messages, error } = await supabase
      .from("campaign_messages")
      .select("*")
      .eq("campaign_id", id)
      .order("position");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify campaign ownership and status
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, status")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (!["draft", "paused"].includes(campaign.status)) {
      return NextResponse.json(
        { error: "Cannot modify messages for running campaign" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      message_type = "text",
      content,
      media_url,
      media_mimetype,
      file_name,
      delay_after = 0,
      position,
    } = body;

    // Get current max position if not specified
    let newPosition = position;
    if (newPosition === undefined) {
      const { data: maxPos } = await supabase
        .from("campaign_messages")
        .select("position")
        .eq("campaign_id", id)
        .order("position", { ascending: false })
        .limit(1)
        .single();

      newPosition = (maxPos?.position ?? -1) + 1;
    }

    const { data: message, error } = await supabase
      .from("campaign_messages")
      .insert({
        campaign_id: id,
        position: newPosition,
        message_type,
        content,
        media_url,
        media_mimetype,
        file_name,
        delay_after,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update messages (bulk update for reordering)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify campaign ownership and status
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, status")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (!["draft", "paused"].includes(campaign.status)) {
      return NextResponse.json(
        { error: "Cannot modify messages for running campaign" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { messages } = body as {
      messages: Array<{
        id: string;
        position?: number;
        message_type?: string;
        content?: string;
        media_url?: string;
        media_mimetype?: string;
        file_name?: string;
        delay_after?: number;
      }>;
    };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array required" },
        { status: 400 }
      );
    }

    // Update each message
    for (const msg of messages) {
      const { id: messageId, ...updates } = msg;
      if (Object.keys(updates).length > 0) {
        await supabase
          .from("campaign_messages")
          .update(updates)
          .eq("id", messageId)
          .eq("campaign_id", id);
      }
    }

    // Fetch updated messages
    const { data: updatedMessages } = await supabase
      .from("campaign_messages")
      .select("*")
      .eq("campaign_id", id)
      .order("position");

    return NextResponse.json({ messages: updatedMessages });
  } catch (error) {
    console.error("Error updating messages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a message (via query param ?messageId=xxx)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const messageId = request.nextUrl.searchParams.get("messageId");

    if (!messageId) {
      return NextResponse.json(
        { error: "messageId query parameter required" },
        { status: 400 }
      );
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify campaign ownership and status
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, status")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (!["draft", "paused"].includes(campaign.status)) {
      return NextResponse.json(
        { error: "Cannot modify messages for running campaign" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("campaign_messages")
      .delete()
      .eq("id", messageId)
      .eq("campaign_id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Reorder remaining messages
    const { data: remainingMessages } = await supabase
      .from("campaign_messages")
      .select("id")
      .eq("campaign_id", id)
      .order("position");

    if (remainingMessages) {
      for (let i = 0; i < remainingMessages.length; i++) {
        await supabase
          .from("campaign_messages")
          .update({ position: i })
          .eq("id", remainingMessages[i].id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
