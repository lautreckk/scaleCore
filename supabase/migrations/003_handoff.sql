-- Phase 3: Human Handoff
-- Adds escalation keywords column and tag removal RPC

ALTER TABLE ai_agents
  ADD COLUMN escalation_keywords TEXT[] NOT NULL DEFAULT '{}';

-- RPC: Atomically remove a tag from a chat's tags array
CREATE OR REPLACE FUNCTION remove_chat_tag(p_chat_id UUID, p_tag TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE chats
  SET tags = array_remove(COALESCE(tags, '{}'), p_tag)
  WHERE id = p_chat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
