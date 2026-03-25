'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Wrench, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import type { ToolCallRecord } from '@/types/intelligence'

interface ToolExecutionCardProps {
  toolCalls: ToolCallRecord[]
}

export function ToolExecutionCard({ toolCalls }: ToolExecutionCardProps) {
  const [expanded, setExpanded] = useState(false)

  if (!toolCalls || toolCalls.length === 0) return null

  return (
    <div className="my-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Wrench className="h-3 w-3" />
        <span>
          {toolCalls.length} ferramenta{toolCalls.length > 1 ? 's' : ''} utilizada{toolCalls.length > 1 ? 's' : ''}
        </span>
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="mt-1 space-y-1 pl-4 border-l-2 border-border">
          {toolCalls.map((tc, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-xs">
              {tc.status === 'pending' && (
                <Loader2 className="h-3 w-3 mt-0.5 animate-spin text-muted-foreground" />
              )}
              {tc.status === 'success' && (
                <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500" />
              )}
              {tc.status === 'error' && (
                <XCircle className="h-3 w-3 mt-0.5 text-red-500" />
              )}
              <div>
                <span className="font-mono text-muted-foreground">{tc.tool_name}</span>
                {tc.duration_ms && (
                  <span className="text-muted-foreground/70 ml-1">({tc.duration_ms}ms)</span>
                )}
                {tc.result != null && (
                  <div className="text-muted-foreground/80 mt-0.5">{String(tc.result)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
