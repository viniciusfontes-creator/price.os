// ============================================
// MEMORY MODULE
// Manages conversation persistence and agent memory
// ============================================

import { getSupabaseAdmin } from '@/lib/supabase-server'
import type { AgentId, ConversationMessage, ConversationSummary } from '@/types/intelligence'
import type { AgentMemory } from './types'

// ============================================
// CONVERSATION OPERATIONS
// ============================================

export async function createConversation(
  userEmail: string,
  title?: string
): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('intelligence_conversations')
    .insert({ user_email: userEmail, title: title || 'Nova conversa' })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating conversation:', error)
    return null
  }
  return data.id
}

export async function getConversations(
  userEmail: string,
  limit = 50
): Promise<ConversationSummary[]> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('intelligence_conversations')
    .select('id, title, created_at, updated_at, last_message_at, message_count')
    .eq('user_email', userEmail)
    .eq('is_archived', false)
    .order('last_message_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching conversations:', error)
    return []
  }
  return data || []
}

export async function getConversationMessages(
  conversationId: string,
  limit = 50,
  offset = 0
): Promise<ConversationMessage[]> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('intelligence_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching messages:', error)
    return []
  }
  return data || []
}

export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system' | 'tool',
  content: string,
  agentId?: AgentId | null,
  toolCalls?: unknown[] | null,
  gatekeeperAction?: unknown | null
): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('intelligence_messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      agent_id: agentId || null,
      tool_calls: toolCalls || null,
      gatekeeper_action: gatekeeperAction || null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error saving message:', error)
    return null
  }
  return data.id
}

export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return

  await supabase
    .from('intelligence_conversations')
    .update({ title })
    .eq('id', conversationId)
}

export async function deleteConversation(
  conversationId: string
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return false

  const { error } = await supabase
    .from('intelligence_conversations')
    .delete()
    .eq('id', conversationId)

  return !error
}

// ============================================
// AGENT MEMORY OPERATIONS
// ============================================

export async function getRelevantMemories(
  userEmail: string,
  limit = 10
): Promise<AgentMemory[]> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('intelligence_memory')
    .select('content, memory_type, relevance_score')
    .eq('user_email', userEmail)
    .order('relevance_score', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching memories:', error)
    return []
  }
  return data || []
}

export async function saveMemory(
  userEmail: string,
  memoryType: 'fact' | 'preference' | 'summary' | 'insight',
  content: string,
  agentId?: AgentId,
  conversationId?: string
): Promise<void> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return

  await supabase.from('intelligence_memory').insert({
    user_email: userEmail,
    memory_type: memoryType,
    content,
    agent_id: agentId || null,
    source_conversation_id: conversationId || null,
  })
}

// ============================================
// GATEKEEPER AUDIT LOG
// ============================================

export async function logGatekeeperAction(
  conversationId: string,
  userEmail: string,
  action: {
    messageId?: string
    actionType: string
    actionDescription: string
    actionPayload: Record<string, unknown>
    impactSummary?: string
    decision: 'approved' | 'rejected' | 'modified'
  }
): Promise<void> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return

  await supabase.from('intelligence_gatekeeper_log').insert({
    conversation_id: conversationId,
    message_id: action.messageId || null,
    user_email: userEmail,
    action_type: action.actionType,
    action_description: action.actionDescription,
    action_payload: action.actionPayload,
    impact_summary: action.impactSummary || null,
    decision: action.decision,
  })
}
