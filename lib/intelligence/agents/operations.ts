// ============================================
// OPERATIONS AGENT - Availability & Calendar
// ============================================

import type { BaseAgent } from './base-agent'
import { getAgentTools } from './base-agent'
import type { AgentContext, StreamCallback } from '../types'
import { getAllTools } from '../tools/tool-registry'
import { processWithTools } from './analyst'

export function createOperationsAgent(): BaseAgent {
  const tools = getAgentTools('operations', getAllTools())

  return {
    id: 'operations',
    name: 'Gestor Operacional',
    description: 'Disponibilidade, ocupacao, calendario',
    tools,

    async process(
      message: string,
      context: AgentContext,
      callbacks: StreamCallback
    ): Promise<string> {
      return processWithTools(message, context, callbacks, tools, 'operations')
    },
  }
}
