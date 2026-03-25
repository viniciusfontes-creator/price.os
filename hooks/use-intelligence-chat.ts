'use client'

import { useState, useCallback, useRef } from 'react'
import { parseSSEStream } from '@/lib/intelligence/stream-utils'
import type {
  ConversationMessage,
  AgentId,
  GatekeeperAction,
  ToolCallRecord,
  StreamEvent,
} from '@/types/intelligence'

interface UseIntelligenceChatReturn {
  messages: ConversationMessage[]
  isLoading: boolean
  currentAgent: AgentId | null
  pendingGatekeeper: GatekeeperAction | null
  currentToolCalls: ToolCallRecord[]
  conversationId: string | null
  sendMessage: (content: string) => Promise<void>
  loadConversation: (id: string) => Promise<void>
  startNewConversation: () => void
  confirmGatekeeper: (decision: 'approved' | 'rejected') => Promise<void>
}

export function useIntelligenceChat(): UseIntelligenceChatReturn {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentAgent, setCurrentAgent] = useState<AgentId | null>(null)
  const [pendingGatekeeper, setPendingGatekeeper] = useState<GatekeeperAction | null>(null)
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCallRecord[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return

      // Add user message to UI immediately
      const userMsg: ConversationMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId || '',
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMsg])
      setIsLoading(true)
      setCurrentToolCalls([])
      setPendingGatekeeper(null)

      try {
        abortRef.current = new AbortController()

        const response = await fetch('/api/intelligence/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            message: content,
          }),
          signal: abortRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        // Create assistant message placeholder
        const assistantId = `temp-${Date.now() + 1}`
        const assistantMsg: ConversationMessage = {
          id: assistantId,
          conversation_id: conversationId || '',
          role: 'assistant',
          content: '',
          agent_id: null,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, assistantMsg])

        let fullContent = ''

        for await (const event of parseSSEStream(response)) {
          switch (event.type) {
            case 'metadata': {
              const convId = event.data.conversationId as string
              if (convId) setConversationId(convId)
              break
            }
            case 'token': {
              const token = event.data.content as string
              fullContent += token
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: fullContent } : m
                )
              )
              break
            }
            case 'agent_switch': {
              const agentId = event.data.to as AgentId
              setCurrentAgent(agentId)
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, agent_id: agentId } : m
                )
              )
              break
            }
            case 'tool_start': {
              const toolCall: ToolCallRecord = {
                tool_name: event.data.toolName as string,
                arguments: (event.data.args as Record<string, unknown>) || {},
                status: 'pending',
              }
              setCurrentToolCalls((prev) => [...prev, toolCall])
              break
            }
            case 'tool_result': {
              setCurrentToolCalls((prev) =>
                prev.map((tc) =>
                  tc.tool_name === (event.data.toolName as string) && tc.status === 'pending'
                    ? {
                        ...tc,
                        result: event.data.summary,
                        duration_ms: event.data.durationMs as number,
                        status: (event.data.success as boolean) ? 'success' : 'error',
                      }
                    : tc
                )
              )
              break
            }
            case 'gatekeeper': {
              setPendingGatekeeper(event.data as unknown as GatekeeperAction)
              break
            }
            case 'done': {
              const title = event.data.title as string | undefined
              if (title) {
                // New conversation was titled
              }
              break
            }
            case 'error': {
              const errorContent = `Erro: ${event.data.message || 'Erro desconhecido'}`
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: errorContent } : m
                )
              )
              break
            }
          }
        }

        // Update assistant message with tool calls
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, tool_calls: currentToolCalls.length > 0 ? currentToolCalls : undefined }
              : m
          )
        )
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          const errorMsg: ConversationMessage = {
            id: `error-${Date.now()}`,
            conversation_id: conversationId || '',
            role: 'assistant',
            content:
              'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
            created_at: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, errorMsg])
        }
      } finally {
        setIsLoading(false)
      }
    },
    [conversationId, isLoading, currentToolCalls]
  )

  const loadConversation = useCallback(async (id: string) => {
    try {
      setConversationId(id)
      setIsLoading(true)

      const response = await fetch(`/api/intelligence/conversations/${id}`)
      const result = await response.json()

      if (result.success && result.data) {
        setMessages(result.data)
      }
    } catch (error) {
      console.error('Error loading conversation:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const startNewConversation = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setCurrentAgent(null)
    setPendingGatekeeper(null)
    setCurrentToolCalls([])
  }, [])

  const confirmGatekeeper = useCallback(
    async (decision: 'approved' | 'rejected') => {
      if (!pendingGatekeeper || !conversationId) return

      try {
        await fetch('/api/intelligence/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionId: pendingGatekeeper.action_id,
            conversationId,
            decision,
            actionType: pendingGatekeeper.action_type,
            actionDescription: pendingGatekeeper.description,
            actionPayload: pendingGatekeeper.parameters,
            impactSummary: pendingGatekeeper.impact,
          }),
        })

        const label = decision === 'approved' ? 'APROVADA' : 'REJEITADA'
        const systemMsg: ConversationMessage = {
          id: `gk-${Date.now()}`,
          conversation_id: conversationId,
          role: 'system',
          content: `Acao ${label}: ${pendingGatekeeper.description}`,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, systemMsg])
        setPendingGatekeeper(null)
      } catch (error) {
        console.error('Gatekeeper confirm error:', error)
      }
    },
    [pendingGatekeeper, conversationId]
  )

  return {
    messages,
    isLoading,
    currentAgent,
    pendingGatekeeper,
    currentToolCalls,
    conversationId,
    sendMessage,
    loadConversation,
    startNewConversation,
    confirmGatekeeper,
  }
}
