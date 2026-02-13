import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const META_GRAPH_API = "https://graph.facebook.com/v21.0";

// GET - List all WhatsApp Official accounts for the tenant
export async function GET() {
  try {
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: accounts, error } = await supabase
      .from("whatsapp_official_accounts")
      .select("*")
      .eq("tenant_id", tenantUser.tenant_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching Meta accounts:", error);
      return NextResponse.json(
        { error: "Failed to fetch accounts" },
        { status: 500 }
      );
    }

    // Mask access tokens in response
    const maskedAccounts = (accounts || []).map((account) => ({
      ...account,
      access_token: account.access_token ? "••••••••" : null,
    }));

    return NextResponse.json({ accounts: maskedAccounts });
  } catch (error) {
    console.error("Error fetching Meta accounts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Exchange Facebook token, fetch WABA info, and save account
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser || !["owner", "admin"].includes(tenantUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { accessToken } = body;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Access token is required" },
        { status: 400 }
      );
    }

    // Step 1: Debug token to get granular scopes and linked assets
    const debugRes = await fetch(
      `${META_GRAPH_API}/debug_token?input_token=${accessToken}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const debugData = await debugRes.json();

    if (debugData.error) {
      console.error("Error debugging token:", debugData.error);
      return NextResponse.json(
        { error: "Invalid access token" },
        { status: 400 }
      );
    }

    // Step 2: Extract WABA IDs from granular scopes
    const granularScopes = debugData.data?.granular_scopes || [];
    const wabaScope = granularScopes.find(
      (s: { scope: string }) =>
        s.scope === "whatsapp_business_management" ||
        s.scope === "whatsapp_business_messaging"
    );

    const wabaIds: string[] = wabaScope?.target_ids || [];

    if (wabaIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhuma conta WhatsApp Business foi compartilhada. Tente novamente e selecione uma conta.",
        },
        { status: 400 }
      );
    }

    const savedAccounts = [];

    for (const wabaId of wabaIds) {
      // Fetch WABA details
      const wabaDetailRes = await fetch(
        `${META_GRAPH_API}/${wabaId}?fields=id,name,currency,message_template_namespace&access_token=${accessToken}`
      );
      const wabaDetail = await wabaDetailRes.json();

      // Fetch phone numbers for this WABA
      const phonesRes = await fetch(
        `${META_GRAPH_API}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&access_token=${accessToken}`
      );
      const phonesData = await phonesRes.json();

      const phoneNumbers = phonesData.data || [];
      const firstPhone = phoneNumbers[0];

      // Upsert account (update if same WABA already exists for this tenant)
      const { data: account, error } = await supabase
        .from("whatsapp_official_accounts")
        .upsert(
          {
            tenant_id: tenantUser.tenant_id,
            waba_id: wabaId,
            phone_number_id: firstPhone?.id || null,
            phone_number: firstPhone?.display_phone_number || null,
            access_token: accessToken,
            name: wabaDetail.name || `WABA ${wabaId}`,
            status: "CONNECTED",
          },
          {
            onConflict: "tenant_id,waba_id",
          }
        )
        .select()
        .single();

      if (error) {
        console.error("Error saving Meta account:", error);
        continue;
      }

      savedAccounts.push({
        ...account,
        access_token: "••••••••",
        phone_numbers: phoneNumbers,
      });
    }

    if (savedAccounts.length === 0) {
      return NextResponse.json(
        { error: "Failed to save any accounts" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      accounts: savedAccounts,
    });
  } catch (error) {
    console.error("Error in Meta embedded signup:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a WhatsApp Official account
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser || !["owner", "admin"].includes(tenantUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("id");

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("whatsapp_official_accounts")
      .delete()
      .eq("id", accountId)
      .eq("tenant_id", tenantUser.tenant_id);

    if (error) {
      console.error("Error deleting Meta account:", error);
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting Meta account:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
