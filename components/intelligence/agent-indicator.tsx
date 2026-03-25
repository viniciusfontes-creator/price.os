'use client'

import { BarChart3, DollarSign, Target, Calendar, Bot } from 'lucide-react'
import type { AgentId } from '@/types/intelligence'

const AGENT_CONFIGS: Record<
  AgentId,
  { name: string; icon: typeof Bot; color: string; bgColor: string }
> = {
  analyst: {
    name: 'Analista de Performance',
    icon: BarChart3,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  pricing: {
    name: 'Estrategista de Pricing',
    icon: DollarSign,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  market: {
    name: 'Inteligencia de Mercado',
    icon: Target,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  operations: {
    name: 'Gestor Operacional',
    icon: Calendar,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  orchestrator: {
    name: 'Assistente Qavi',
    icon: Bot,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
}

interface AgentIndicatorProps {
  agentId: AgentId | null | undefined
  size?: 'sm' | 'md'
}

export function AgentIndicator({ agentId, size = 'sm' }: AgentIndicatorProps) {
  if (!agentId) return null

  const config = AGENT_CONFIGS[agentId] || AGENT_CONFIGS.orchestrator
  const Icon = config.icon

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs'
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1'

  return (
    <div
      className={`inline-flex items-center gap-1 ${config.bgColor} ${config.color} rounded-full ${padding}`}
    >
      <Icon className={iconSize} />
      <span className={`${textSize} font-medium`}>{config.name}</span>
    </div>
  )
}
