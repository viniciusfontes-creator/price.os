'use client'

import { User, Info } from 'lucide-react'
import type { ConversationMessage, GatekeeperAction } from '@/types/intelligence'
import { AgentIndicator } from './agent-indicator'
import { MarkdownRenderer } from './markdown-renderer'
import { ToolExecutionCard } from './tool-execution-card'
import { GatekeeperDialog } from './gatekeeper-dialog'

interface MessageBubbleProps {
  message: ConversationMessage
  pendingGatekeeper?: GatekeeperAction | null
  onGatekeeperConfirm?: (decision: 'approved' | 'rejected') => void
}

export function MessageBubble({
  message,
  pendingGatekeeper,
  onGatekeeperConfirm,
}: MessageBubbleProps) {
  if (message.role === 'system') {
    return (
      <div className="flex justify-center my-2">
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1">
          <Info className="h-3 w-3" />
          {message.content}
        </div>
      </div>
    )
  }

  if (message.role === 'user') {
    return (
      <div className="flex gap-2 justify-end">
        <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          <div className="text-[10px] opacity-70 mt-1 text-right">
            {formatTime(message.created_at)}
          </div>
        </div>
        <div className="flex-shrink-0 mt-1 h-7 w-7 rounded-full bg-muted flex items-center justify-center">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    )
  }

  // Assistant message
  return (
    <div className="flex gap-2 items-start">
      <div className="flex-shrink-0 mt-1">
        <AgentIndicator agentId={message.agent_id} size="sm" />
      </div>
      <div className="max-w-[85%] space-y-1">
        <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5">
          {message.tool_calls && message.tool_calls.length > 0 && (
            <ToolExecutionCard toolCalls={message.tool_calls} />
          )}

          {message.content ? (
            <MarkdownRenderer content={message.content} />
          ) : (
            <p className="text-sm text-muted-foreground italic">Processando...</p>
          )}

          <div className="text-[10px] text-muted-foreground/70 mt-1">
            {formatTime(message.created_at)}
          </div>
        </div>

        {pendingGatekeeper && onGatekeeperConfirm && (
          <GatekeeperDialog
            action={pendingGatekeeper}
            onConfirm={onGatekeeperConfirm}
          />
        )}
      </div>
    </div>
  )
}

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}
