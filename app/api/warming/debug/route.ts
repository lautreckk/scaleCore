import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/encryption";
import { createEvolutionClient } from "@/lib/evolution/client";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/warming/debug - Test Evolution API endpoints used in warming
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

    // Get warming config instances for this tenant
    const { data: warmingConfigs } = await supabase
      .from("warming_configs")
      .select("id, name")
      .eq("tenant_id", tenantUser.tenant_id)
      .limit(1);

    if (!warmingConfigs || warmingConfigs.length === 0) {
      return NextResponse.json({ error: "No warming configs found" }, { status: 404 });
    }

    const configId = warmingConfigs[0].id;

    // Get instances
    const { data: configInstances } = await supabase
      .from("warming_config_instances")
      .select(`
        *,
        whatsapp_instance:instance_id (
          id,
          instance_name,
          phone_number,
          status,
          evolution_config_id
        )
      `)
      .eq("warming_config_id", configId)
      .eq("is_active", true)
      .limit(2);

    if (!configInstances || configInstances.length < 2) {
      return NextResponse.json({
        error: "Not enough active instances",
        found: configInstances?.length || 0
      }, { status: 400 });
    }

    const sender = configInstances[0].whatsapp_instance;
    const receiver = configInstances[1].whatsapp_instance;

    if (!sender.evolution_config_id) {
      return NextResponse.json({ error: "Sender has no evolution config" }, { status: 400 });
    }

    // Get Evolution API config
    const { data: evolutionConfig } = await supabase
      .from("evolution_api_configs")
      .select("url, api_key_encrypted")
      .eq("id", sender.evolution_config_id)
      .single();

    if (!evolutionConfig) {
      return NextResponse.json({ error: "Evolution config not found" }, { status: 404 });
    }

    // Decrypt API key
    const apiKey = decrypt(evolutionConfig.api_key_encrypted);
    const client = createEvolutionClient({
      url: evolutionConfig.url,
      apiKey,
    });

    const receiverNumber = receiver.phone_number?.replace(/\D/g, "") || "";

    const results: Record<string, unknown> = {
      config: {
        evolutionUrl: evolutionConfig.url,
        senderInstance: sender.instance_name,
        senderStatus: sender.status,
        receiverInstance: receiver.instance_name,
        receiverNumber: receiverNumber,
        receiverStatus: receiver.status,
      },
      tests: {},
    };

    // Test 1: Connection test
    try {
      const connectionResult = await client.testConnection();
      results.tests = {
        ...results.tests as object,
        connection: connectionResult,
      };
    } catch (e) {
      results.tests = {
        ...results.tests as object,
        connection: { success: false, error: e instanceof Error ? e.message : String(e) },
      };
    }

    // Test 2: Get connection state of sender instance
    try {
      const stateResult = await client.getConnectionState(sender.instance_name);
      results.tests = {
        ...results.tests as object,
        connectionState: stateResult,
      };
    } catch (e) {
      results.tests = {
        ...results.tests as object,
        connectionState: { success: false, error: e instanceof Error ? e.message : String(e) },
      };
    }

    // Test 3: Find messages (used in warming)
    try {
      const messagesResult = await client.findMessages(sender.instance_name, {
        where: { key: { remoteJid: receiverNumber + "@s.whatsapp.net" } },
        page: 1,
        offset: 0,
      });
      results.tests = {
        ...results.tests as object,
        findMessages: {
          success: messagesResult.success,
          error: messagesResult.error,
          messageCount: messagesResult.data?.length || 0,
        },
      };
    } catch (e) {
      results.tests = {
        ...results.tests as object,
        findMessages: { success: false, error: e instanceof Error ? e.message : String(e) },
      };
    }

    // Test 4: Find status messages
    try {
      const statusResult = await client.findStatusMessages(
        sender.instance_name,
        receiverNumber + "@s.whatsapp.net"
      );
      results.tests = {
        ...results.tests as object,
        findStatusMessages: {
          success: statusResult.success,
          error: statusResult.error,
          statusCount: statusResult.data?.length || 0,
        },
      };
    } catch (e) {
      results.tests = {
        ...results.tests as object,
        findStatusMessages: { success: false, error: e instanceof Error ? e.message : String(e) },
      };
    }

    // Test 5: Send presence (typing)
    try {
      const presenceResult = await client.sendPresence(sender.instance_name, {
        number: receiverNumber,
        presence: "composing",
        delay: 1000,
      });
      results.tests = {
        ...results.tests as object,
        sendPresence: presenceResult,
      };
    } catch (e) {
      results.tests = {
        ...results.tests as object,
        sendPresence: { success: false, error: e instanceof Error ? e.message : String(e) },
      };
    }

    // Test 6: Send text message (DRY RUN - only if requested)
    const body = await request.json().catch(() => ({}));
    if (body.sendTestMessage === true) {
      try {
        const textResult = await client.sendText(sender.instance_name, {
          number: receiverNumber,
          text: "🔧 Teste de diagnóstico do warming - ignore esta mensagem",
        });
        results.tests = {
          ...results.tests as object,
          sendText: textResult,
        };
      } catch (e) {
        results.tests = {
          ...results.tests as object,
          sendText: { success: false, error: e instanceof Error ? e.message : String(e) },
        };
      }
    } else {
      results.tests = {
        ...results.tests as object,
        sendText: { skipped: true, message: "Pass sendTestMessage: true to test" },
      };
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Warming debug error:", error);
    return NextResponse.json(
      {
        error: "Debug failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
