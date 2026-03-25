'use client'

import { Bot } from 'lucide-react'

export function ThinkingIndicator() {
  return (
    <div className="flex gap-2 items-start">
      <div className="flex-shrink-0 mt-1 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
        <Bot className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="bg-muted rounded-lg px-3 py-2">
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
          <div
            className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"
            style={{ animationDelay: '0.1s' }}
          />
          <div
            className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"
            style={{ animationDelay: '0.2s' }}
          />
        </div>
      </div>
    </div>
  )
}
