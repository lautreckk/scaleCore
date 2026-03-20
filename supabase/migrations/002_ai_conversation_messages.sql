-- Table: ai_conversation_messages (conversation memory for AI agents)
CREATE TABLE ai_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remote_jid TEXT NOT NULL,
  instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient sliding window queries (last N messages by lead+instance)
CREATE INDEX idx_ai_conv_msgs_lookup
  ON ai_conversation_messages(remote_jid, instance_id, created_at DESC);

-- Index for agent-scoped queries (cleanup, stats)
CREATE INDEX idx_ai_conv_msgs_agent
  ON ai_conversation_messages(agent_id);

-- Enable RLS
ALTER TABLE ai_conversation_messages ENABLE ROW LEVEL SECURITY;

-- RLS policy: tenant isolation via agent's tenant_id
CREATE POLICY "Tenant isolation via agent" ON ai_conversation_messages
  FOR ALL USING (
    agent_id IN (
      SELECT id FROM ai_agents WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
      )
    )
  );
