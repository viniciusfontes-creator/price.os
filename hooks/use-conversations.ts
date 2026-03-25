'use client'

import useSWR from 'swr'
import type { ConversationSummary } from '@/types/intelligence'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Erro ao buscar dados')
  return json.data
}

export function useConversations() {
  const { data, error, isLoading, mutate } = useSWR<ConversationSummary[]>(
    '/api/intelligence/conversations',
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 30000, // Refresh every 30s
    }
  )

  const deleteConversation = async (id: string) => {
    try {
      await fetch(`/api/intelligence/conversations/${id}`, { method: 'DELETE' })
      mutate()
    } catch (error) {
      console.error('Error deleting conversation:', error)
    }
  }

  const renameConversation = async (id: string, title: string) => {
    try {
      await fetch(`/api/intelligence/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      mutate()
    } catch (error) {
      console.error('Error renaming conversation:', error)
    }
  }

  return {
    conversations: data || [],
    isLoading,
    error,
    refresh: mutate,
    deleteConversation,
    renameConversation,
  }
}
