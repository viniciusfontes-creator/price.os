import type { ToolDefinition, ToolResult } from '../types'
import { saveMemory } from '../memory'

import type { AgentContext } from '../types'

export const memoryTools: ToolDefinition[] = [
  {
    name: 'store_knowledge',
    description:
      'Armazena na memoria de longo prazo aprendizados importantes, como: preferencias de formato ou interpretacao de palavras do usuario (ex: se refere a praca tal quando diz praia tal), feedback de ferramentas que nao estao funcionando ou resultados ruins, pontos de melhoria para o time de agentes.',
    parameters: {
      memory_type: {
        type: 'string',
        description: 'Tipo da memoria: "fact", "preference", "summary", ou "insight"',
        required: true,
        enum: ['fact', 'preference', 'summary', 'insight'],
      },
      content: {
        type: 'string',
        description: 'O conteudo do aprendizado de forma sucinta e util para execucoes futuras.',
        required: true,
      },
    },
    requiresConfirmation: false,
    allowedAgents: ['analyst', 'pricing', 'market', 'operations'],
    execute: async (params: Record<string, unknown>, context?: AgentContext): Promise<ToolResult> => {
      try {
        const { memory_type, content } = params
        const typeStr = String(memory_type) as 'fact' | 'preference' | 'summary' | 'insight'
        const contentStr = String(content)

        if (!context?.userEmail) {
          return {
            success: false,
            error: 'Sem usuario identificado para salvar memoria',
            summary: 'Nao foi possivel armazenar a memoria (usuario anonimo).',
          }
        }

        await saveMemory(context.userEmail, typeStr, contentStr)

        return {
          success: true,
          data: { saved: true, memory_type: typeStr, content: contentStr },
          summary: `Memoria de longo prazo salva com sucesso (tipo: ${typeStr}). O time de agentes conseguirá acessar isso nas próximas interações.`,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro ao salvar memoria',
          summary: 'Falha ao armazenar aprendizado na memoria.',
        }
      }
    },
  },
]
