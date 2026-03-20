-- Table: ai_agents
CREATE TABLE ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL DEFAULT '',
  model_id TEXT NOT NULL,
  activation_tag TEXT NOT NULL,
  tag_apply_mode TEXT NOT NULL DEFAULT 'new_only',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_tag_per_tenant UNIQUE (tenant_id, activation_tag)
);

ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON ai_agents
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_ai_agents_tenant_tag ON ai_agents(tenant_id, activation_tag);
CREATE INDEX idx_ai_agents_tenant_id ON ai_agents(tenant_id);

-- Table: ai_agent_instances (junction)
CREATE TABLE ai_agent_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_agent_instance UNIQUE (agent_id, instance_id)
);

ALTER TABLE ai_agent_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON ai_agent_instances
  FOR ALL USING (
    agent_id IN (
      SELECT id FROM ai_agents WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE INDEX idx_ai_agent_instances_agent ON ai_agent_instances(agent_id);
CREATE INDEX idx_ai_agent_instances_instance ON ai_agent_instances(instance_id);

-- RPC: bulk apply tag to chats
CREATE OR REPLACE FUNCTION apply_agent_tag(p_instance_ids UUID[], p_tag TEXT)
RETURNS INTEGER AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE chats
  SET tags = array_append(COALESCE(tags, '{}'), p_tag)
  WHERE instance_id = ANY(p_instance_ids)
    AND NOT (COALESCE(tags, '{}') @> ARRAY[p_tag]);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
