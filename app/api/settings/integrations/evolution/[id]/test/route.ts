import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";
import { createEvolutionClient } from "@/lib/evolution/client";

// POST - Test connection to an Evolution API server
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

    const { data: config, error } = await supabase
      .from("evolution_api_configs")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (error || !config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    // Decrypt API key and test connection
    const apiKey = decrypt(config.api_key_encrypted);
    const client = createEvolutionClient({
      url: config.url,
      apiKey,
    });

    const result = await client.testConnection();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Connection successful",
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || "Connection failed",
      });
    }
  } catch (error) {
    console.error("Error testing Evolution connection:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
