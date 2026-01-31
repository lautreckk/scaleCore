import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

function getValueFromPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { source_id: string } }
) {
  const sourceId = params.source_id;

  try {
    // Get lead source
    const { data: source, error: sourceError } = await supabase
      .from("lead_sources")
      .select("*")
      .eq("id", sourceId)
      .single();

    if (sourceError || !source) {
      return NextResponse.json(
        { error: "Lead source not found" },
        { status: 404 }
      );
    }

    if (!source.active) {
      return NextResponse.json(
        { error: "Lead source is inactive" },
        { status: 400 }
      );
    }

    const body = await request.text();
    const signature = request.headers.get("x-signature") || request.headers.get("x-webhook-signature") || "";

    // Log webhook event
    const webhookEvent = {
      source_id: sourceId,
      event_type: "lead_webhook",
      payload: JSON.parse(body),
      signature_valid: false,
      processed: false,
    };

    // Verify signature if secret is set
    if (source.webhook_secret && signature) {
      const isValid = verifyHmacSignature(body, signature, source.webhook_secret);
      webhookEvent.signature_valid = isValid;

      if (!isValid) {
        await supabase.from("webhook_events").insert({
          ...webhookEvent,
          error_message: "Invalid signature",
        });
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    const payload = JSON.parse(body);
    const fieldMapping = source.field_mapping as Record<string, string> | null;

    // Apply field mapping
    let leadData: Record<string, unknown> = {
      tenant_id: source.tenant_id,
      source_id: sourceId,
      name: "Unknown",
    };

    if (fieldMapping) {
      // Map fields from payload using JSON paths
      if (fieldMapping.name) {
        leadData.name = getValueFromPath(payload, fieldMapping.name) || "Unknown";
      }
      if (fieldMapping.email) {
        leadData.email = getValueFromPath(payload, fieldMapping.email);
      }
      if (fieldMapping.phone) {
        leadData.phone = getValueFromPath(payload, fieldMapping.phone);
      }
      if (fieldMapping.external_id) {
        leadData.external_id = getValueFromPath(payload, fieldMapping.external_id);
      }
      if (fieldMapping.cpf) {
        leadData.cpf = getValueFromPath(payload, fieldMapping.cpf);
      }

      // Store remaining fields as custom_fields
      const mappedFields = Object.values(fieldMapping);
      const customFields: Record<string, unknown> = {};

      Object.entries(payload).forEach(([key, value]) => {
        if (!mappedFields.includes(key)) {
          customFields[key] = value;
        }
      });

      if (Object.keys(customFields).length > 0) {
        leadData.custom_fields = customFields;
      }
    } else {
      // Default mapping if no field mapping is configured
      leadData = {
        ...leadData,
        name: payload.name || payload.nome || payload.full_name || "Unknown",
        email: payload.email || payload.e_mail,
        phone: payload.phone || payload.telefone || payload.whatsapp || payload.celular,
        external_id: payload.id || payload.external_id,
        custom_fields: payload,
      };
    }

    // Get default board and first stage for leads
    let defaultBoardId: string | null = null;
    let defaultStageId: string | null = null;

    const { data: defaultBoard } = await supabase
      .from("kanban_boards")
      .select(`
        id,
        kanban_stages(id, position)
      `)
      .eq("tenant_id", source.tenant_id)
      .eq("is_default", true)
      .in("entity_type", ["leads", "both"])
      .limit(1)
      .single();

    if (defaultBoard) {
      defaultBoardId = defaultBoard.id;
      // Get first stage (position = 0)
      const stages = defaultBoard.kanban_stages as Array<{ id: string; position: number }>;
      if (stages && stages.length > 0) {
        const sortedStages = stages.sort((a, b) => a.position - b.position);
        defaultStageId = sortedStages[0].id;
      }
    }

    // Add board, stage, and source type to lead data
    leadData.board_id = defaultBoardId;
    leadData.stage_id = defaultStageId;
    leadData.source = "webhook";

    // Upsert lead (update if external_id exists)
    let lead;
    if (leadData.external_id) {
      const { data: existingLead } = await supabase
        .from("leads")
        .select("id")
        .eq("tenant_id", source.tenant_id)
        .eq("source_id", sourceId)
        .eq("external_id", leadData.external_id)
        .single();

      if (existingLead) {
        const { data, error } = await supabase
          .from("leads")
          .update({
            ...leadData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingLead.id)
          .select()
          .single();

        if (error) throw error;
        lead = data;
      } else {
        const { data, error } = await supabase
          .from("leads")
          .insert(leadData)
          .select()
          .single();

        if (error) throw error;
        lead = data;
      }
    } else {
      const { data, error } = await supabase
        .from("leads")
        .insert(leadData)
        .select()
        .single();

      if (error) throw error;
      lead = data;
    }

    // Update source lead count
    await supabase
      .from("lead_sources")
      .update({ total_leads: (source.total_leads || 0) + 1 })
      .eq("id", sourceId);

    // Log activity
    await supabase.from("lead_activities").insert({
      lead_id: lead.id,
      type: "created",
      content: "Lead criado via webhook",
      metadata: { source: source.name },
    });

    // Mark webhook event as processed
    await supabase.from("webhook_events").insert({
      ...webhookEvent,
      signature_valid: true,
      processed: true,
    });

    // TODO: Trigger automations for lead.created event

    return NextResponse.json({
      success: true,
      lead_id: lead.id,
    });
  } catch (error) {
    console.error("Webhook error:", error);

    await supabase.from("webhook_events").insert({
      source_id: sourceId,
      event_type: "lead_webhook",
      payload: {},
      signature_valid: false,
      processed: false,
      error_message: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Return webhook info
export async function GET(
  request: NextRequest,
  { params }: { params: { source_id: string } }
) {
  return NextResponse.json({
    webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/${params.source_id}`,
    method: "POST",
    content_type: "application/json",
    signature_header: "x-signature",
  });
}
