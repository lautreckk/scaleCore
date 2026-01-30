import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST - Test a webhook forward by sending a test payload
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Get the webhook forward
    const { data: forward, error: forwardError } = await supabase
      .from("webhook_forwards")
      .select(`
        *,
        whatsapp_instances(id, name, instance_name)
      `)
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (forwardError || !forward) {
      return NextResponse.json({ error: "Webhook forward not found" }, { status: 404 });
    }

    // Create a test payload
    const testPayload = {
      event: "TEST",
      instance: forward.whatsapp_instances?.instance_name || "test-instance",
      data: {
        test: true,
        message: "This is a test webhook from ScaleCore CRM",
        timestamp: new Date().toISOString(),
        forward_id: forward.id,
        forward_name: forward.name,
      },
      date_time: new Date().toISOString(),
      sender: "ScaleCore CRM",
    };

    // Send the test webhook
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(forward.headers || {}),
    };

    const startTime = Date.now();

    try {
      const response = await fetch(forward.target_url, {
        method: "POST",
        headers,
        body: JSON.stringify(testPayload),
      });

      const responseTime = Date.now() - startTime;
      const responseBody = await response.text().catch(() => "");

      if (response.ok) {
        // Update last success
        await supabase
          .from("webhook_forwards")
          .update({ last_success_at: new Date().toISOString() })
          .eq("id", forward.id);

        return NextResponse.json({
          success: true,
          status: response.status,
          statusText: response.statusText,
          responseTime,
          response: responseBody.slice(0, 1000),
        });
      } else {
        // Update last error
        const errorMessage = `HTTP ${response.status}: ${responseBody.slice(0, 500)}`;
        await supabase
          .from("webhook_forwards")
          .update({
            last_error_at: new Date().toISOString(),
            last_error_message: errorMessage,
          })
          .eq("id", forward.id);

        return NextResponse.json({
          success: false,
          status: response.status,
          statusText: response.statusText,
          responseTime,
          error: errorMessage,
        });
      }
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : "Connection failed";

      // Update last error
      await supabase
        .from("webhook_forwards")
        .update({
          last_error_at: new Date().toISOString(),
          last_error_message: errorMessage,
        })
        .eq("id", forward.id);

      return NextResponse.json({
        success: false,
        error: errorMessage,
        responseTime: Date.now() - startTime,
      });
    }
  } catch (error) {
    console.error("Error in POST /api/webhook-forwards/[id]/test:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
