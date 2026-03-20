-- Media library for AI agents
CREATE TABLE ai_agent_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'audio', 'document')),
  file_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_agent_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation via agent" ON ai_agent_media
  FOR ALL USING (
    agent_id IN (
      SELECT id FROM ai_agents WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE INDEX idx_ai_agent_media_agent ON ai_agent_media(agent_id);
CREATE INDEX idx_ai_agent_media_active ON ai_agent_media(agent_id, is_active) WHERE is_active = true;
