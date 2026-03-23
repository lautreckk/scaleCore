import type {
  PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotionSyncConfig {
  notion_api_key: string; // already decrypted
  notion_database_id: string;
  stage_mapping: Record<string, string>; // scalecore_stage_id → notion_status
  field_mapping: Record<string, string>; // scalecore_field → notion_property
  default_operation?: string | null;
  default_responsible?: string | null;
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
  // Joined from kanban
  stage_id?: string | null;
  stage_name?: string | null;
}

export interface SyncMetrics {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ lead_id: string; lead_name: string | null; error: string }>;
}

export interface NotionDatabaseInfo {
  name: string;
  properties: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildProperties(
  lead: LeadToSync,
  config: NotionSyncConfig
): Record<string, unknown> {
  const props: Record<string, unknown> = {};

  // Default field mapping if none configured
  const mapping: Record<string, string> =
    Object.keys(config.field_mapping).length > 0
      ? config.field_mapping
      : {
          name: "Nome",
          phone: "WhatsApp",
          email: "Email",
          company: "Empresa",
          status: "Status Lead",
        };

  for (const [scaleField, notionProp] of Object.entries(mapping)) {
    const value = getFieldValue(lead, scaleField);
    if (value === null || value === undefined || value === "") continue;

    const strValue = String(value);

    // "Status" fields get mapped as select
    if (
      notionProp.toLowerCase().includes("status") ||
      notionProp.toLowerCase().includes("etapa")
    ) {
      props[notionProp] = { select: { name: strValue } };
    } else if (
      notionProp.toLowerCase() === "email" ||
      scaleField === "email"
    ) {
      props[notionProp] = { email: strValue };
    } else if (
      notionProp.toLowerCase() === "whatsapp" ||
      notionProp.toLowerCase() === "telefone" ||
      notionProp.toLowerCase() === "phone" ||
      scaleField === "phone"
    ) {
      props[notionProp] = { phone_number: strValue };
    } else if (
      notionProp.toLowerCase() === "nome" ||
      notionProp.toLowerCase() === "name" ||
      notionProp.toLowerCase() === "empresa" ||
      notionProp.toLowerCase() === "nome/empresa"
    ) {
      // Title property (first one found) or rich_text
      props[notionProp] = {
        title: [{ text: { content: strValue } }],
      };
    } else {
      props[notionProp] = {
        rich_text: [{ text: { content: strValue } }],
      };
    }
  }

  // Map kanban stage → Notion status via stage_mapping
  if (lead.stage_id && config.stage_mapping[lead.stage_id]) {
    const notionStatus = config.stage_mapping[lead.stage_id];
    // Find the status/etapa property in mapping, or default to "Status"
    const statusProp =
      Object.entries(mapping).find(
        ([, v]) =>
          v.toLowerCase().includes("status") ||
          v.toLowerCase().includes("etapa")
      )?.[1] || "Status";
    props[statusProp] = { select: { name: notionStatus } };
  }

  // Defaults
  if (config.default_operation) {
    props["Operacao"] = {
      rich_text: [{ text: { content: config.default_operation } }],
    };
  }
  if (config.default_responsible) {
    props["Responsavel"] = {
      rich_text: [{ text: { content: config.default_responsible } }],
    };
  }

  return props;
}

function getFieldValue(
  lead: LeadToSync,
  field: string
): string | null | undefined {
  // Direct lead fields
  if (field in lead) {
    return (lead as unknown as Record<string, unknown>)[field] as string | null;
  }
  // Custom fields
  if (lead.custom_fields && field in lead.custom_fields) {
    return lead.custom_fields[field] as string | null;
  }
  return null;
}

/**
 * Extract a text value from a Notion property for matching.
 */
function extractPropertyText(prop: unknown): string | null {
  if (!prop || typeof prop !== "object") return null;
  const p = prop as Record<string, unknown>;

  if (p.type === "title" && Array.isArray(p.title)) {
    return (p.title as Array<{ plain_text?: string }>)[0]?.plain_text ?? null;
  }
  if (p.type === "rich_text" && Array.isArray(p.rich_text)) {
    return (
      (p.rich_text as Array<{ plain_text?: string }>)[0]?.plain_text ?? null
    );
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
   * Test connection: reads the database and returns its name + properties.
   */
  async testConnection(): Promise<NotionDatabaseInfo> {
    const db = await this.notionFetch(`/databases/${this.databaseId}`, "GET");

    const name =
      db.title?.[0]?.plain_text ?? "Sem nome";
    const properties = Object.keys(db.properties ?? {});

    return { name, properties };
  }

  /**
   * Direct REST calls to Notion API with stable version header.
   * Avoids SDK v5 breaking changes with dataSources vs databases.
   */
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
        (err as Record<string, unknown>).message as string || `Notion API ${res.status}: ${res.statusText}`
      );
    }

    return res.json();
  }

  /**
   * Sync a batch of leads to the Notion database.
   * Matches existing pages by phone number or name to avoid duplicates.
   */
  async syncLeads(leads: LeadToSync[]): Promise<SyncMetrics> {
    const metrics: SyncMetrics = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    // Build index of existing Notion pages for dedup
    const existingPages = await this.fetchExistingPages();

    for (const lead of leads) {
      try {
        const match = this.findMatch(lead, existingPages);
        const properties = buildProperties(lead, this.config);

        if (match) {
          // Update existing page
          await this.notionFetch(`/pages/${match.id}`, "PATCH", {
            properties,
          });
          metrics.updated++;
        } else {
          // Create new page
          await this.notionFetch("/pages", "POST", {
            parent: { database_id: this.databaseId },
            properties,
          });
          metrics.created++;
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        metrics.errors.push({
          lead_id: lead.id,
          lead_name: lead.name,
          error: message,
        });
      }
    }

    return metrics;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

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

      // Match by phone
      if (lead.phone) {
        for (const prop of Object.values(props)) {
          const text = extractPropertyText(prop);
          if (text && this.normalizePhone(text) === this.normalizePhone(lead.phone)) {
            return page;
          }
        }
      }

      // Match by name (title property)
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
