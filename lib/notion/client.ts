import type {
  PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotionSyncConfig {
  notion_api_key: string; // already decrypted
  notion_database_id: string;
  stage_mapping: Record<string, string>; // scalecore_stage_id → notion_property_value
  field_mapping: Record<string, string>; // scalecore_field → notion_property_name
  property_types?: Record<string, string>; // notion_property_name → notion_type (cached)
  default_operation?: string | null;
  default_responsible?: string | null;
  defaults_mapping?: Record<string, string>; // notion_property_name → default_value
}

export interface LeadToSync {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company?: string | null;
  status: string | null;
  tags: string[] | null;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  stage_id?: string | null;
  stage_name?: string | null;
}

export interface SyncMetrics {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ lead_id: string; lead_name: string | null; error: string }>;
}

export interface NotionProperty {
  name: string;
  type: string;
}

export interface NotionDatabaseInfo {
  name: string;
  properties: NotionProperty[];
}

// Available ScaleCore lead fields for mapping
export const SCALECORE_FIELDS = [
  { key: "name", label: "Nome" },
  { key: "phone", label: "Telefone/WhatsApp" },
  { key: "email", label: "Email" },
  { key: "company", label: "Empresa" },
  { key: "status", label: "Status do Lead" },
  { key: "tags", label: "Tags" },
  { key: "stage_name", label: "Stage do Kanban" },
  { key: "created_at", label: "Data de Criacao" },
  { key: "updated_at", label: "Data de Atualizacao" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build Notion properties using the REAL property types from the database.
 * No guessing by name — uses the type map from databases.retrieve().
 */
function buildProperties(
  lead: LeadToSync,
  config: NotionSyncConfig
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const typeMap = config.property_types ?? {};

  // Field mapping: scalecore_field → notion_property_name
  for (const [scaleField, notionProp] of Object.entries(config.field_mapping)) {
    const value = getFieldValue(lead, scaleField);
    if (value === null || value === undefined || value === "") continue;

    const strValue = String(value);
    const propType = typeMap[notionProp] ?? "rich_text";

    props[notionProp] = formatValueForType(strValue, propType);
  }

  // Stage mapping: kanban stage_id → notion status value
  if (lead.stage_id && config.stage_mapping[lead.stage_id]) {
    const notionStatus = config.stage_mapping[lead.stage_id];
    // Find which property is the stage target (mapped from "stage_name" field)
    const stageProp = config.field_mapping["stage_name"];
    if (stageProp) {
      const propType = typeMap[stageProp] ?? "select";
      props[stageProp] = formatValueForType(notionStatus, propType);
    }
  }

  // Defaults mapping: notion_property_name → default_value
  if (config.defaults_mapping) {
    for (const [notionProp, defaultValue] of Object.entries(config.defaults_mapping)) {
      if (!defaultValue || props[notionProp]) continue; // don't override mapped values
      const propType = typeMap[notionProp] ?? "rich_text";
      props[notionProp] = formatValueForType(defaultValue, propType);
    }
  }

  // Legacy defaults (backwards compat)
  if (config.default_operation && !config.defaults_mapping) {
    props["Operacao"] = { rich_text: [{ text: { content: config.default_operation } }] };
  }
  if (config.default_responsible && !config.defaults_mapping) {
    props["Responsavel"] = { rich_text: [{ text: { content: config.default_responsible } }] };
  }

  return props;
}

/**
 * Format a string value into the correct Notion property structure
 * based on the actual property type from the database schema.
 */
function formatValueForType(value: string, type: string): unknown {
  switch (type) {
    case "title":
      return { title: [{ text: { content: value } }] };
    case "rich_text":
      return { rich_text: [{ text: { content: value } }] };
    case "number":
      return { number: parseFloat(value) || 0 };
    case "select":
      return { select: { name: value } };
    case "multi_select":
      return { multi_select: value.split(",").map((v) => ({ name: v.trim() })) };
    case "status":
      return { status: { name: value } };
    case "date":
      return { date: { start: value } };
    case "checkbox":
      return { checkbox: value === "true" || value === "1" };
    case "url":
      return { url: value };
    case "email":
      return { email: value };
    case "phone_number":
      return { phone_number: value };
    default:
      return { rich_text: [{ text: { content: value } }] };
  }
}

function getFieldValue(
  lead: LeadToSync,
  field: string
): string | null | undefined {
  if (field in lead) {
    return (lead as unknown as Record<string, unknown>)[field] as string | null;
  }
  if (lead.custom_fields && field in lead.custom_fields) {
    return lead.custom_fields[field] as string | null;
  }
  return null;
}

function extractPropertyText(prop: unknown): string | null {
  if (!prop || typeof prop !== "object") return null;
  const p = prop as Record<string, unknown>;

  if (p.type === "title" && Array.isArray(p.title)) {
    return (p.title as Array<{ plain_text?: string }>)[0]?.plain_text ?? null;
  }
  if (p.type === "rich_text" && Array.isArray(p.rich_text)) {
    return (p.rich_text as Array<{ plain_text?: string }>)[0]?.plain_text ?? null;
  }
  if (p.type === "phone_number") return p.phone_number as string | null;
  if (p.type === "email") return p.email as string | null;
  return null;
}

// ---------------------------------------------------------------------------
// Core Client
// ---------------------------------------------------------------------------

export class NotionSyncClient {
  private databaseId: string;
  private config: NotionSyncConfig;

  constructor(config: NotionSyncConfig) {
    this.databaseId = config.notion_database_id;
    this.config = config;
  }

  /**
   * Test connection + return database name and ALL properties with types.
   */
  async testConnection(): Promise<NotionDatabaseInfo> {
    const db = await this.notionFetch(`/databases/${this.databaseId}`, "GET");

    const name = db.title?.[0]?.plain_text ?? "Sem nome";

    const properties: NotionProperty[] = Object.entries(db.properties ?? {}).map(
      ([propName, propDef]) => ({
        name: propName,
        type: (propDef as Record<string, unknown>).type as string,
      })
    );

    return { name, properties };
  }

  /**
   * Sync leads to Notion. Deduplicates by phone or name.
   */
  async syncLeads(leads: LeadToSync[]): Promise<SyncMetrics> {
    const metrics: SyncMetrics = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    const existingPages = await this.fetchExistingPages();

    for (const lead of leads) {
      try {
        const match = this.findMatch(lead, existingPages);
        const properties = buildProperties(lead, this.config);

        if (Object.keys(properties).length === 0) {
          metrics.skipped++;
          continue;
        }

        if (match) {
          await this.notionFetch(`/pages/${match.id}`, "PATCH", { properties });
          metrics.updated++;
        } else {
          await this.notionFetch("/pages", "POST", {
            parent: { database_id: this.databaseId },
            properties,
          });
          metrics.created++;
        }
      } catch (err) {
        metrics.errors.push({
          lead_id: lead.id,
          lead_name: lead.name,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return metrics;
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async notionFetch(path: string, method: string, body?: unknown): Promise<any> {
    const res = await fetch(`https://api.notion.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.notion_api_key}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as Record<string, unknown>).message as string ||
          `Notion API ${res.status}: ${res.statusText}`
      );
    }

    return res.json();
  }

  private async fetchExistingPages(): Promise<PageObjectResponse[]> {
    const pages: PageObjectResponse[] = [];
    let cursor: string | undefined;

    for (let i = 0; i < 20; i++) {
      const body: Record<string, unknown> = { page_size: 100 };
      if (cursor) body.start_cursor = cursor;

      const data = await this.notionFetch(
        `/databases/${this.databaseId}/query`,
        "POST",
        body
      );

      for (const page of data.results) {
        if ("properties" in page) {
          pages.push(page as unknown as PageObjectResponse);
        }
      }

      if (!data.has_more || !data.next_cursor) break;
      cursor = data.next_cursor;
    }

    return pages;
  }

  private findMatch(
    lead: LeadToSync,
    pages: PageObjectResponse[]
  ): PageObjectResponse | null {
    for (const page of pages) {
      const props = page.properties;

      if (lead.phone) {
        for (const prop of Object.values(props)) {
          const text = extractPropertyText(prop);
          if (text && this.normalizePhone(text) === this.normalizePhone(lead.phone)) {
            return page;
          }
        }
      }

      if (lead.name) {
        for (const prop of Object.values(props)) {
          const p = prop as Record<string, unknown>;
          if (p.type === "title") {
            const text = extractPropertyText(prop);
            if (text && text.toLowerCase() === lead.name.toLowerCase()) {
              return page;
            }
          }
        }
      }
    }

    return null;
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, "");
  }
}
