-- ============================================================
-- Migration 005: Notion Integration (multi-tenant sync)
-- ============================================================

-- 1. notion_sync_config — one config per tenant
CREATE TABLE notion_sync_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  notion_api_key TEXT NOT NULL,
  notion_database_id TEXT NOT NULL,
  sync_enabled BOOLEAN DEFAULT false,
  sync_direction TEXT DEFAULT 'scalecore_to_notion'
    CHECK (sync_direction IN ('scalecore_to_notion', 'notion_to_scalecore', 'bidirectional')),
  sync_interval_minutes INTEGER DEFAULT 360,
  stage_mapping JSONB DEFAULT '{}',
  field_mapping JSONB DEFAULT '{}',
  default_operation TEXT,
  default_responsible TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE notion_sync_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON notion_sync_config
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_notion_sync_config_tenant ON notion_sync_config(tenant_id);
CREATE INDEX idx_notion_sync_config_enabled ON notion_sync_config(sync_enabled) WHERE sync_enabled = true;

-- 2. notion_sync_log — audit trail for syncs
CREATE TABLE notion_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
  leads_created INTEGER DEFAULT 0,
  leads_updated INTEGER DEFAULT 0,
  leads_skipped INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE notion_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON notion_sync_log
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_notion_sync_log_tenant ON notion_sync_log(tenant_id);
CREATE INDEX idx_notion_sync_log_started ON notion_sync_log(started_at DESC);
