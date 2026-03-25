'use client'

import { useState } from 'react'
import { Plus, ChevronDown, Trash2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useIntelligenceChat } from '@/hooks/use-intelligence-chat'
import { useConversations } from '@/hooks/use-conversations'
import { ChatArea } from './chat-area'

export function IntelligenceHub() {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const {
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
  } = useIntelligenceChat()

  const {
    conversations,
    isLoading: conversationsLoading,
    deleteConversation,
    refresh: refreshConversations,
  } = useConversations()

  const handleSelectConversation = async (id: string) => {
    setDropdownOpen(false)
    await loadConversation(id)
  }

  const handleNewConversation = () => {
    setDropdownOpen(false)
    startNewConversation()
  }

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteConversation(id)
    if (id === conversationId) {
      startNewConversation()
    }
  }

  const handleSendMessage = async (content: string) => {
    await sendMessage(content)
    refreshConversations()
  }

  const activeConversation = conversations.find((c) => c.id === conversationId)
  const activeTitle = activeConversation?.title || 'Nova conversa'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar with conversation selector */}
      <div className="border-b px-4 py-2 flex items-center justify-end gap-2 bg-background shrink-0">
        <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 max-w-xs"
              role="combobox"
              aria-expanded={dropdownOpen}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-xs">
                {conversationId ? activeTitle : 'Nova conversa'}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="end">
            <div className="p-2 border-b">
              <Button
                size="sm"
                className="w-full gap-1.5"
                onClick={handleNewConversation}
              >
                <Plus className="h-3.5 w-3.5" />
                Nova conversa
              </Button>
            </div>
            <ScrollArea className="max-h-64">
              <div className="p-1">
                {conversationsLoading && conversations.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-3">
                    Carregando...
                  </div>
                )}
                {!conversationsLoading && conversations.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-3">
                    Nenhuma conversa ainda.
                  </div>
                )}
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
                      conversationId === conv.id
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => handleSelectConversation(conv.id)}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-xs">{conv.title}</span>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                      {formatRelativeDate(conv.last_message_at || conv.updated_at)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      {/* Main chat area */}
      <div className="flex-1 min-h-0">
        <ChatArea
          messages={messages}
          isLoading={isLoading}
          currentAgent={currentAgent}
          pendingGatekeeper={pendingGatekeeper}
          currentToolCalls={currentToolCalls}
          onSendMessage={handleSendMessage}
          onGatekeeperConfirm={confirmGatekeeper}
        />
      </div>
    </div>
  )
}

function formatRelativeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'agora'
    if (diffMins < 60) return `${diffMins}min`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  } catch {
    return ''
  }
}
