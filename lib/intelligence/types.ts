// ============================================
// INTELLIGENCE HUB - SERVER-SIDE TYPES
// ============================================

import type { AgentId, ToolCallRecord, GatekeeperAction } from '@/types/intelligence'

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, ToolParameter>
  execute: (params: Record<string, unknown>, context?: AgentContext) => Promise<ToolResult>
  requiresConfirmation: boolean
  allowedAgents: AgentId[]
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array'
  description: string
  required: boolean
  enum?: string[]
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  summary: string // Human-readable summary for the LLM
}

export interface AgentContext {
  userEmail: string
  conversationHistory: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool'
    content: string
    agent_id?: AgentId
  }>
  memories: AgentMemory[]
}

export interface AgentMemory {
  content: string
  memory_type: 'fact' | 'preference' | 'summary' | 'insight'
  relevance_score: number
}

export interface AgentResponse {
  content: string
  agent_id: AgentId
  tool_calls?: ToolCallRecord[]
  gatekeeper_action?: GatekeeperAction
  tokens_used?: number
}

export interface ClassificationResult {
  agentId: AgentId
  reason: string
  confidence: number
}

export interface StreamCallback {
  onToken: (token: string) => void
  onToolStart: (toolName: string, args: Record<string, unknown>) => void
  onToolResult: (toolName: string, result: ToolResult, durationMs: number) => void
  onGatekeeper: (action: GatekeeperAction) => void
  onAgentSwitch: (fromAgent: AgentId | null, toAgent: AgentId, reason: string) => void
  onError: (error: string) => void
}
