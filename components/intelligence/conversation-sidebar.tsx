'use client'

import { useState } from 'react'
import { Plus, Search, MessageSquare, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ConversationSummary } from '@/types/intelligence'

interface ConversationSidebarProps {
  conversations: ConversationSummary[]
  activeId: string | null
  isLoading: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  isOpen: boolean
  onToggle: () => void
}

export function ConversationSidebar({
  conversations,
  activeId,
  isLoading,
  onSelect,
  onNew,
  onDelete,
  isOpen,
  onToggle,
}: ConversationSidebarProps) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase())
      )
    : conversations

  const grouped = groupByDate(filtered)

  if (!isOpen) return null

  return (
    <div className="w-72 border-r bg-muted/30 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b flex items-center gap-2">
        <Button onClick={onNew} size="sm" className="flex-1 gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Nova conversa
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 lg:hidden"
          onClick={onToggle}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
          {isLoading && conversations.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-4">
              Carregando conversas...
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-4">
              {search ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa ainda.'}
            </div>
          )}

          {Object.entries(grouped).map(([label, items]) => (
            <div key={label}>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
                {label}
              </div>
              <div className="space-y-0.5">
                {items.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
                      activeId === conv.id
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => onSelect(conv.id)}
                  >
                    <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-xs">{conv.title}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(conv.id)
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

function groupByDate(
  conversations: ConversationSummary[]
): Record<string, ConversationSummary[]> {
  const groups: Record<string, ConversationSummary[]> = {}
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const lastWeek = new Date(today)
  lastWeek.setDate(lastWeek.getDate() - 7)

  for (const conv of conversations) {
    const date = new Date(conv.last_message_at || conv.updated_at)
    let label: string

    if (date >= today) {
      label = 'Hoje'
    } else if (date >= yesterday) {
      label = 'Ontem'
    } else if (date >= lastWeek) {
      label = 'Ultimos 7 dias'
    } else {
      label = 'Anteriores'
    }

    if (!groups[label]) groups[label] = []
    groups[label].push(conv)
  }

  return groups
}
