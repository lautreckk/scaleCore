import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evolutionApi } from "@/lib/evolution/client";

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
    const { instanceName, to, message, mediaUrl, mediaType } = body;

    if (!instanceName || !to || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify instance belongs to tenant
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id, status")
      .eq("instance_name", instanceName)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!instance) {
      return NextResponse.json(
        { error: "Instance not found" },
        { status: 404 }
      );
    }

    if (instance.status !== "connected") {
      return NextResponse.json(
        { error: "Instance not connected" },
        { status: 400 }
      );
    }

    // Check wallet balance
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    const messageCost = 0.12;
    if (!wallet || wallet.balance < messageCost) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 402 }
      );
    }

    // Format phone number
    const phoneNumber = to.replace("@s.whatsapp.net", "").replace("@g.us", "");

    // Send message via Evolution API
    let result;
    if (mediaUrl && mediaType) {
      result = await evolutionApi.sendMedia(instanceName, {
        number: phoneNumber,
        mediatype: mediaType,
        mimetype: getMimeType(mediaType),
        caption: message,
        media: mediaUrl,
      });
    } else {
      result = await evolutionApi.sendText(instanceName, {
        number: phoneNumber,
        text: message,
      });
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send message" },
        { status: 500 }
      );
    }

    // Deduct from wallet
    await supabase.rpc("deduct_wallet_balance", {
      p_tenant_id: tenantUser.tenant_id,
      p_amount: messageCost,
      p_description: "Envio de mensagem WhatsApp",
    });

    // The message will be saved via webhook when Evolution API sends the confirmation

    return NextResponse.json({
      success: true,
      messageId: result.data?.key?.id,
    });
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function getMimeType(mediaType: string): string {
  switch (mediaType) {
    case "image":
      return "image/jpeg";
    case "video":
      return "video/mp4";
    case "audio":
      return "audio/mpeg";
    case "document":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}
