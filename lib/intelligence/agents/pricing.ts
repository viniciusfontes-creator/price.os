// ============================================
// PRICING AGENT - Pricing Strategist
// ============================================

import type { BaseAgent } from './base-agent'
import { getAgentTools } from './base-agent'
import type { AgentContext, StreamCallback } from '../types'
import { getAllTools } from '../tools/tool-registry'
import { processWithTools } from './analyst'

export function createPricingAgent(): BaseAgent {
  const tools = getAgentTools('pricing', getAllTools())

  return {
    id: 'pricing',
    name: 'Estrategista de Pricing',
    description: 'Tarifas, precos, ajustes de diaria, posicionamento',
    tools,

    async process(
      message: string,
      context: AgentContext,
      callbacks: StreamCallback
    ): Promise<string> {
      return processWithTools(message, context, callbacks, tools, 'pricing')
    },
  }
}
