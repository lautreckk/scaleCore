import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEvolutionClientByInstanceName } from "@/lib/evolution/config";

// POST /api/whatsapp/chat/check
// Check if numbers are registered on WhatsApp
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
    const { instanceName, numbers } = body;

    if (!instanceName || !numbers || !Array.isArray(numbers)) {
      return NextResponse.json(
        { error: "Missing required fields: instanceName, numbers (array)" },
        { status: 400 }
      );
    }

    if (numbers.length === 0) {
      return NextResponse.json({ success: true, results: [] });
    }

    if (numbers.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 numbers per request" },
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

    // Clean phone numbers
    const cleanNumbers = numbers.map((n: string) =>
      n.replace("@s.whatsapp.net", "").replace("@g.us", "").replace(/\D/g, "")
    );

    const result = await client.checkIsWhatsApp(instanceName, {
      numbers: cleanNumbers,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to check numbers" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      results: result.data || [],
    });
  } catch (error) {
    console.error("Error checking WhatsApp numbers:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
