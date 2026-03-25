// ============================================
// MARKET AGENT - Market Intelligence
// ============================================

import type { BaseAgent } from './base-agent'
import { getAgentTools } from './base-agent'
import type { AgentContext, StreamCallback } from '../types'
import { getAllTools } from '../tools/tool-registry'
import { processWithTools } from './analyst'

export function createMarketAgent(): BaseAgent {
  const tools = getAgentTools('market', getAllTools())

  return {
    id: 'market',
    name: 'Inteligencia de Mercado',
    description: 'Concorrentes Airbnb, baskets, tendencias',
    tools,

    async process(
      message: string,
      context: AgentContext,
      callbacks: StreamCallback
    ): Promise<string> {
      return processWithTools(message, context, callbacks, tools, 'market')
    },
  }
}
