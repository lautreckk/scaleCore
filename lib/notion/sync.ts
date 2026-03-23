import { decrypt } from "@/lib/encryption";
import { NotionSyncClient, type LeadToSync } from "@/lib/notion/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeSyncForTenant(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  tenantId: string,
  config: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  logId: string,
  syncType: string
) {
  try {
    const apiKey = decrypt(config.notion_api_key);

    const client = new NotionSyncClient({
      notion_api_key: apiKey,
      notion_database_id: config.notion_database_id,
      stage_mapping: config.stage_mapping ?? {},
      field_mapping: config.field_mapping ?? {},
      default_operation: config.default_operation,
      default_responsible: config.default_responsible,
    });

    // Fetch leads — incremental (since last_sync_at) or full
    let query = supabase
      .from("leads")
      .select("id, name, email, phone, company, status, tags, custom_fields, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: true });

    // Only incremental (cron) filters by last_sync_at; manual and full always sync everything
    if (syncType === "incremental" && config.last_sync_at) {
      query = query.gt("updated_at", config.last_sync_at);
    }

    const { data: rawLeads, error: leadsError } = await query;
    if (leadsError) throw leadsError;

    const leads: LeadToSync[] = rawLeads ?? [];

    // Enrich with kanban stage info
    if (leads.length > 0) {
      const leadIds = leads.map((l: LeadToSync) => l.id);

      const { data: kanbanItems } = await supabase
        .from("kanban_items")
        .select("entity_id, stage_id, kanban_stages(id, name)")
        .eq("entity_type", "leads")
        .in("entity_id", leadIds);

      if (kanbanItems) {
        const stageMap = new Map<string, { stage_id: string; stage_name: string }>();
        for (const item of kanbanItems) {
          const stage = item.kanban_stages as { id: string; name: string } | null;
          if (stage) {
            stageMap.set(item.entity_id, {
              stage_id: stage.id,
              stage_name: stage.name,
            });
          }
        }
        for (const lead of leads) {
          const stageInfo = stageMap.get(lead.id);
          if (stageInfo) {
            lead.stage_id = stageInfo.stage_id;
            lead.stage_name = stageInfo.stage_name;
          }
        }
      }
    }

    if (leads.length === 0) {
      await supabase
        .from("notion_sync_log")
        .update({
          status: "success",
          leads_skipped: 0,
          completed_at: new Date().toISOString(),
        })
        .eq("id", logId);

      return;
    }

    // Execute sync
    const metrics = await client.syncLeads(leads);

    const status =
      metrics.errors.length === 0
        ? "success"
        : metrics.created + metrics.updated > 0
          ? "partial"
          : "failed";

    await supabase
      .from("notion_sync_log")
      .update({
        status,
        leads_created: metrics.created,
        leads_updated: metrics.updated,
        leads_skipped: metrics.skipped,
        errors: metrics.errors,
        completed_at: new Date().toISOString(),
      })
      .eq("id", logId);

    // Update last_sync_at
    await supabase
      .from("notion_sync_config")
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);
  } catch (error) {
    console.error(`Notion sync failed for tenant ${tenantId}:`, error);

    await supabase
      .from("notion_sync_log")
      .update({
        status: "failed",
        errors: [
          {
            lead_id: "system",
            lead_name: null,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        ],
        completed_at: new Date().toISOString(),
      })
      .eq("id", logId);
  }
}
