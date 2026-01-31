import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get campaigns with instance and message count
    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select(`
        *,
        whatsapp_instances(id, instance_name, status),
        campaign_messages(id)
      `)
      .eq("tenant_id", tenantUser.tenant_id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to include message count
    const campaignsWithCounts = campaigns?.map((campaign) => ({
      ...campaign,
      message_count: campaign.campaign_messages?.length || 0,
      campaign_messages: undefined, // Remove the array to reduce payload
    }));

    return NextResponse.json({ campaigns: campaignsWithCounts });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      instance_id,
      tags,
      messages,
      filter_criteria,
      delay_between_messages = 3,
      delay_between_recipients = 5,
      scheduled_at,
      leads, // Array of lead IDs to add as recipients
    } = body;

    if (!name || !instance_id) {
      return NextResponse.json(
        { error: "Name and instance_id are required" },
        { status: 400 }
      );
    }

    // Verify instance belongs to tenant
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id")
      .eq("id", instance_id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!instance) {
      return NextResponse.json(
        { error: "Invalid WhatsApp instance" },
        { status: 400 }
      );
    }

    // Calculate message count
    const messageCount = messages?.length || 1;

    // Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        tenant_id: tenantUser.tenant_id,
        instance_id,
        name,
        tags: tags || [],
        status: scheduled_at ? "scheduled" : "draft",
        scheduled_at: scheduled_at || null,
        filter_criteria: filter_criteria || {},
        delay_between_messages,
        delay_between_recipients,
        total_recipients: leads?.length || 0,
        estimated_cost: (leads?.length || 0) * messageCount * 0.12,
        created_by: user.id,
      })
      .select()
      .single();

    if (campaignError) {
      return NextResponse.json(
        { error: campaignError.message },
        { status: 500 }
      );
    }

    // Create campaign messages
    if (messages && Array.isArray(messages) && messages.length > 0) {
      const messagesToInsert = messages.map((msg: {
        message_type?: string;
        content?: string;
        media_url?: string;
        media_mimetype?: string;
        file_name?: string;
        delay_after?: number;
      }, index: number) => ({
        campaign_id: campaign.id,
        position: index,
        message_type: msg.message_type || "text",
        content: msg.content || "",
        media_url: msg.media_url || null,
        media_mimetype: msg.media_mimetype || null,
        file_name: msg.file_name || null,
        delay_after: msg.delay_after || 0,
      }));

      const { error: messagesError } = await supabase
        .from("campaign_messages")
        .insert(messagesToInsert);

      if (messagesError) {
        // Rollback campaign creation
        await supabase.from("campaigns").delete().eq("id", campaign.id);
        return NextResponse.json(
          { error: messagesError.message },
          { status: 500 }
        );
      }
    }

    // Create campaign sends for leads
    if (leads && Array.isArray(leads) && leads.length > 0) {
      // Get lead phones
      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, phone")
        .in("id", leads)
        .eq("tenant_id", tenantUser.tenant_id);

      if (leadsData && leadsData.length > 0) {
        const sendsToInsert = leadsData.map((lead) => ({
          campaign_id: campaign.id,
          lead_id: lead.id,
          phone: lead.phone,
          status: "pending",
          total_messages: messageCount,
        }));

        const { error: sendsError } = await supabase
          .from("campaign_sends")
          .insert(sendsToInsert);

        if (sendsError) {
          console.error("Error creating campaign sends:", sendsError);
        }
      }
    }

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error("Error creating campaign:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
