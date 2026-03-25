// ============================================
// BASE AGENT INTERFACE
// ============================================

import type { AgentId } from '@/types/intelligence'
import type { ToolDefinition, AgentContext, StreamCallback } from '../types'
import { getBusinessContext } from '../business-context'

export interface BaseAgent {
  id: AgentId
  name: string
  description: string
  tools: ToolDefinition[]

  process(
    message: string,
    context: AgentContext,
    callbacks: StreamCallback
  ): Promise<string>
}

/**
 * Get tools available to a specific agent from the registry
 */
export function getAgentTools(
  agentId: AgentId,
  allTools: ToolDefinition[]
): ToolDefinition[] {
  return allTools.filter((tool) => tool.allowedAgents.includes(agentId))
}

/**
 * Format tool descriptions for the LLM system prompt
 */
export function formatToolDescriptions(tools: ToolDefinition[]): string {
  if (tools.length === 0) return 'Nenhuma ferramenta disponivel.'

  return tools
    .map((tool) => {
      const params = Object.entries(tool.parameters)
        .map(
          ([name, p]) =>
            `  - ${name} (${p.type}${p.required ? ', obrigatorio' : ', opcional'}): ${p.description}`
        )
        .join('\n')

      return `## ${tool.name}
${tool.description}
Parametros:
${params}${tool.requiresConfirmation ? '\n⚠️ Esta ferramenta requer confirmacao do usuario antes de executar.' : ''}`
    })
    .join('\n\n')
}

/**
 * Build the full system prompt for an agent
 */
export function buildAgentSystemPrompt(
  basePrompt: string,
  tools: ToolDefinition[],
  memories: Array<{ content: string; memory_type: string }>
): string {
  const parts = [getBusinessContext(), '\n\n', basePrompt]

  if (tools.length > 0) {
    parts.push(`\n\n--- FERRAMENTAS DISPONIVEIS ---\n\nVoce pode usar as seguintes ferramentas para buscar dados. Para chamar uma ferramenta, responda com um bloco JSON no formato:
\`\`\`tool_call
{"tool": "nome_da_ferramenta", "arguments": {"param1": "valor1"}}
\`\`\`

${formatToolDescriptions(tools)}`)
  }

  if (memories.length > 0) {
    const memoryText = memories
      .map((m) => `- [${m.memory_type}] ${m.content}`)
      .join('\n')
    parts.push(
      `\n\n--- CONTEXTO DO USUARIO (memorias anteriores) ---\n${memoryText}`
    )
  }

  return parts.join('')
}
