'use client'

import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ConversationMessage, AgentId, GatekeeperAction, ToolCallRecord } from '@/types/intelligence'
import { MessageBubble } from './message-bubble'
import { ThinkingIndicator } from './thinking-indicator'
import { SuggestionChips } from './suggestion-chips'
import { IntelligenceInput } from './intelligence-input'
import { AgentIndicator } from './agent-indicator'
import { ToolExecutionCard } from './tool-execution-card'

interface ChatAreaProps {
  messages: ConversationMessage[]
  isLoading: boolean
  currentAgent: AgentId | null
  pendingGatekeeper: GatekeeperAction | null
  currentToolCalls: ToolCallRecord[]
  onSendMessage: (message: string) => void
  onGatekeeperConfirm: (decision: 'approved' | 'rejected') => void
}

export function ChatArea({
  messages,
  isLoading,
  currentAgent,
  pendingGatekeeper,
  currentToolCalls,
  onSendMessage,
  onGatekeeperConfirm,
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, currentToolCalls])

  const isEmpty = messages.length === 0

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      {currentAgent && (
        <div className="border-b px-4 py-2 flex items-center gap-2 shrink-0">
          <AgentIndicator agentId={currentAgent} size="md" />
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {isEmpty && !isLoading ? (
            <SuggestionChips onSelect={onSendMessage} />
          ) : (
            <div className="space-y-4">
              {messages.map((msg, idx) => {
                const isLast = idx === messages.length - 1
                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    pendingGatekeeper={
                      isLast && msg.role === 'assistant' ? pendingGatekeeper : null
                    }
                    onGatekeeperConfirm={
                      isLast && msg.role === 'assistant' ? onGatekeeperConfirm : undefined
                    }
                  />
                )
              })}

              {/* Show tool calls in progress */}
              {isLoading && currentToolCalls.length > 0 && (
                <div className="flex gap-2 items-start">
                  <AgentIndicator agentId={currentAgent} size="sm" />
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5">
                    <ToolExecutionCard toolCalls={currentToolCalls} />
                  </div>
                </div>
              )}

              {/* Thinking indicator */}
              {isLoading && <ThinkingIndicator />}

              {/* Scroll anchor */}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="shrink-0">
        <IntelligenceInput onSend={onSendMessage} isLoading={isLoading} />
      </div>
    </div>
  )
}
