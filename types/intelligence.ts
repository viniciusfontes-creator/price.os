// ============================================
// INTELLIGENCE HUB - SHARED TYPES
// Used by both frontend and backend
// ============================================

export type AgentId = 'analyst' | 'pricing' | 'market' | 'operations' | 'orchestrator'

export interface ConversationSummary {
  id: string
  title: string
  created_at: string
  updated_at: string
  last_message_at: string
  message_count: number
}

export interface ConversationMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  agent_id?: AgentId | null
  tool_calls?: ToolCallRecord[] | null
  gatekeeper_action?: GatekeeperAction | null
  created_at: string
  metadata?: Record<string, unknown>
}

export interface ToolCallRecord {
  tool_name: string
  arguments: Record<string, unknown>
  result?: unknown
  duration_ms?: number
  status: 'pending' | 'success' | 'error'
}

export interface GatekeeperAction {
  action_id: string
  agent_id: AgentId
  action_type: string
  description: string
  impact: string
  parameters: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'modified'
}

// SSE Event types for streaming
export type StreamEventType =
  | 'metadata'
  | 'token'
  | 'tool_start'
  | 'tool_result'
  | 'gatekeeper'
  | 'agent_switch'
  | 'done'
  | 'error'

export interface StreamEvent {
  type: StreamEventType
  data: Record<string, unknown>
}

// Chat request/response
export interface ChatRequest {
  conversationId: string | null
  message: string
}

export interface ConfirmRequest {
  actionId: string
  conversationId: string
  decision: 'approved' | 'rejected' | 'modified'
  modifiedParameters?: Record<string, unknown>
}

// Agent config for frontend display
export interface AgentDisplayConfig {
  id: AgentId
  name: string
  description: string
  color: string
  bgColor: string
}

export const AGENT_DISPLAY_CONFIGS: Record<AgentId, AgentDisplayConfig> = {
  analyst: {
    id: 'analyst',
    name: 'Analista de Performance',
    description: 'Receita, vendas, metas e rankings',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  pricing: {
    id: 'pricing',
    name: 'Estrategista de Pricing',
    description: 'Tarifas, precos e posicionamento',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  market: {
    id: 'market',
    name: 'Inteligencia de Mercado',
    description: 'Concorrentes e tendencias',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  operations: {
    id: 'operations',
    name: 'Gestor Operacional',
    description: 'Disponibilidade e ocupacao',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  orchestrator: {
    id: 'orchestrator',
    name: 'Assistente Qavi',
    description: 'Orquestrador principal',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
}
