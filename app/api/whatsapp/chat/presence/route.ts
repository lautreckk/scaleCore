import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEvolutionClientByInstanceName } from "@/lib/evolution/config";

// POST /api/whatsapp/chat/presence
// Send presence (typing, recording, paused) to a chat
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
    const { instanceName, to, presence, delay } = body;

    if (!instanceName || !to || !presence) {
      return NextResponse.json(
        { error: "Missing required fields: instanceName, to, presence" },
        { status: 400 }
      );
    }

    // Validate presence type
    if (!["composing", "recording", "paused"].includes(presence)) {
      return NextResponse.json(
        { error: "Invalid presence type. Must be: composing, recording, or paused" },
        { status: 400 }
      );
    }

    const clientData = await getEvolutionClientByInstanceName(
      instanceName,
      tenantUser.tenant_id
    );

    if (!clientData) {
      return NextResponse.json(
        { error: "Instance not found" },
        { status: 404 }
      );
    }

    const { client } = clientData;
    const phoneNumber = to.replace("@s.whatsapp.net", "").replace("@g.us", "");

    const result = await client.sendPresence(instanceName, {
      number: phoneNumber,
      presence,
      delay: delay || 1000,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send presence" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending presence:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
