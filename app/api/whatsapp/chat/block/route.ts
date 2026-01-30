import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEvolutionClientByInstanceName } from "@/lib/evolution/config";

// POST /api/whatsapp/chat/block
// Block or unblock a contact
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
    const { instanceName, number, status } = body;

    if (!instanceName || !number || !status) {
      return NextResponse.json(
        { error: "Missing required fields: instanceName, number, status" },
        { status: 400 }
      );
    }

    // Validate status
    if (!["block", "unblock"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be: block or unblock" },
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
    const phoneNumber = number.replace("@s.whatsapp.net", "").replace("@g.us", "");

    const result = await client.updateBlockStatus(instanceName, {
      number: phoneNumber,
      status,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to update block status" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("Error updating block status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
