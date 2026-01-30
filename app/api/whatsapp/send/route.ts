import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEvolutionClientByInstanceName } from "@/lib/evolution/config";

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
    const { instanceName, to, message, mediaUrl, mediaType, fileName } = body;

    // Validate: need either message or mediaUrl
    if (!instanceName || !to || (!message && !mediaUrl)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get the Evolution client for this instance
    const clientData = await getEvolutionClientByInstanceName(
      instanceName,
      tenantUser.tenant_id
    );

    if (!clientData) {
      return NextResponse.json(
        { error: "Instance not found or no Evolution server configured" },
        { status: 404 }
      );
    }

    const { client, instance } = clientData;

    // Verify instance is connected
    const { data: instanceData } = await supabase
      .from("whatsapp_instances")
      .select("status")
      .eq("id", instance.id)
      .single();

    if (!instanceData || instanceData.status !== "connected") {
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
      result = await client.sendMedia(instanceName, {
        number: phoneNumber,
        mediatype: mediaType,
        mimetype: getMimeType(mediaType, fileName),
        caption: message || "",
        media: mediaUrl,
        fileName: fileName,
      });
    } else {
      result = await client.sendText(instanceName, {
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

function getMimeType(mediaType: string, fileName?: string): string {
  // Try to determine from filename extension
  if (fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      // Images
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      // Videos
      mp4: "video/mp4",
      mov: "video/quicktime",
      webm: "video/webm",
      // Audio
      mp3: "audio/mpeg",
      ogg: "audio/ogg",
      wav: "audio/wav",
      m4a: "audio/mp4",
      // Documents
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      txt: "text/plain",
      zip: "application/zip",
    };
    if (ext && mimeMap[ext]) {
      return mimeMap[ext];
    }
  }

  // Fallback based on mediaType
  switch (mediaType) {
    case "image":
      return "image/jpeg";
    case "video":
      return "video/mp4";
    case "audio":
      return "audio/ogg";
    case "document":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}
