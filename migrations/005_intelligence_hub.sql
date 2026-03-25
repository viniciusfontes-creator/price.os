-- =============================================
-- Migration 005: Intelligence Hub Tables
-- Run in Supabase Dashboard > SQL Editor
-- =============================================

-- Conversations table
CREATE TABLE IF NOT EXISTS intelligence_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT NOT NULL,
    title TEXT DEFAULT 'Nova conversa',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_message_at TIMESTAMPTZ DEFAULT now(),
    message_count INTEGER DEFAULT 0,
    is_archived BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_conversations_user ON intelligence_conversations(user_email);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON intelligence_conversations(updated_at DESC);

-- Messages table
CREATE TABLE IF NOT EXISTS intelligence_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES intelligence_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    agent_id TEXT,
    tool_calls JSONB,
    gatekeeper_action JSONB,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON intelligence_messages(conversation_id, created_at);

-- Agent memory table (cross-conversation learning)
CREATE TABLE IF NOT EXISTS intelligence_memory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('fact', 'preference', 'summary', 'insight')),
    content TEXT NOT NULL,
    agent_id TEXT,
    relevance_score FLOAT DEFAULT 1.0,
    source_conversation_id UUID REFERENCES intelligence_conversations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_memory_user ON intelligence_memory(user_email);
CREATE INDEX IF NOT EXISTS idx_memory_type ON intelligence_memory(memory_type);

-- Gatekeeper audit log
CREATE TABLE IF NOT EXISTS intelligence_gatekeeper_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES intelligence_conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES intelligence_messages(id) ON DELETE SET NULL,
    user_email TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_description TEXT NOT NULL,
    action_payload JSONB NOT NULL,
    impact_summary TEXT,
    decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'modified')),
    decided_at TIMESTAMPTZ DEFAULT now(),
    executed_at TIMESTAMPTZ,
    execution_result JSONB,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_gatekeeper_conversation ON intelligence_gatekeeper_log(conversation_id);

-- Enable RLS
ALTER TABLE intelligence_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_gatekeeper_log ENABLE ROW LEVEL SECURITY;

-- Service role policies (all access from server-side with service_role key)
CREATE POLICY "Service role full access conversations" ON intelligence_conversations
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access messages" ON intelligence_messages
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access memory" ON intelligence_memory
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access gatekeeper" ON intelligence_gatekeeper_log
    FOR ALL USING (true) WITH CHECK (true);

-- Function to auto-update conversation metadata when a message is inserted
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE intelligence_conversations
    SET
        last_message_at = NEW.created_at,
        message_count = message_count + 1,
        updated_at = now()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_intelligence_message_insert
    AFTER INSERT ON intelligence_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_on_message();
