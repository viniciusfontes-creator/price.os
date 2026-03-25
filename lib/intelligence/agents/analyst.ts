// ============================================
// ANALYST AGENT - Revenue & Performance
// ============================================

import { GoogleGenerativeAI } from '@google/generative-ai'
import type { BaseAgent } from './base-agent'
import { getAgentTools, buildAgentSystemPrompt } from './base-agent'
import type { AgentContext, StreamCallback, ToolDefinition } from '../types'
import { AGENT_PROMPTS } from '../prompts'
import { getAllTools } from '../tools/tool-registry'
import { getToolByName } from '../tools/tool-registry'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export function createAnalystAgent(): BaseAgent {
  const tools = getAgentTools('analyst', getAllTools())

  return {
    id: 'analyst',
    name: 'Analista de Performance',
    description: 'Receita, vendas, metas, performance, rankings',
    tools,

    async process(
      message: string,
      context: AgentContext,
      callbacks: StreamCallback
    ): Promise<string> {
      return processWithTools(message, context, callbacks, tools, 'analyst')
    },
  }
}

/**
 * Shared agent processing logic with tool calling support.
 * Used by all 4 agents - they differ only in system prompt and available tools.
 */
export async function processWithTools(
  message: string,
  context: AgentContext,
  callbacks: StreamCallback,
  tools: ToolDefinition[],
  agentId: 'analyst' | 'pricing' | 'market' | 'operations'
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.7,
      topP: 1,
      topK: 1,
      maxOutputTokens: 4096,
    },
  })

  const systemPrompt = buildAgentSystemPrompt(
    AGENT_PROMPTS[agentId],
    tools,
    context.memories
  )

  // Build history from conversation context
  const history = context.conversationHistory
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }],
    }))

  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Entendido. Estou pronto para analisar os dados usando as ferramentas disponiveis.' }] },
      ...history,
    ],
  })

  let fullResponse = ''
  let iterations = 0
  const maxIterations = 8 // Allow complex multi-step analyses
  let currentMessage = message

  while (iterations < maxIterations) {
    iterations++

    const result = await chat.sendMessageStream(currentMessage)
    let iterResponse = ''

    for await (const chunk of result.stream) {
      const text = chunk.text()
      iterResponse += text
    }

    // Check if the response contains a tool call
    const toolCallMatch = iterResponse.match(/```tool_call\s*\n([\s\S]*?)\n```/)

    if (toolCallMatch) {
      // Extract text before the tool call
      const textBefore = iterResponse.substring(0, iterResponse.indexOf('```tool_call')).trim()
      if (textBefore) {
        fullResponse += textBefore
        callbacks.onToken(textBefore)
      }

      try {
        const toolCall = JSON.parse(toolCallMatch[1])
        const toolName = toolCall.tool
        const toolArgs = toolCall.arguments || {}

        callbacks.onToolStart(toolName, toolArgs)

        const toolDef = getToolByName(toolName)
        if (!toolDef) {
          const errorMsg = `Ferramenta "${toolName}" nao encontrada.`
          callbacks.onToolResult(toolName, { success: false, error: errorMsg, summary: errorMsg }, 0)
          currentMessage = `Erro: ${errorMsg}. Tente outra abordagem.`
          continue
        }

        // Check gatekeeper
        if (toolDef.requiresConfirmation) {
          callbacks.onGatekeeper({
            action_id: crypto.randomUUID(),
            agent_id: agentId,
            action_type: toolName,
            description: `Agente ${agentId} quer executar: ${toolName}`,
            impact: toolDef.description,
            parameters: toolArgs,
            status: 'pending',
          })
          fullResponse += '\n\n⚠️ Esta acao requer confirmacao do usuario.'
          callbacks.onToken('\n\n⚠️ Esta acao requer confirmacao do usuario.')
          break
        }

        // Execute tool
        const startTime = Date.now()
        const toolResult = await toolDef.execute(toolArgs, context)
        const duration = Date.now() - startTime

        callbacks.onToolResult(toolName, toolResult, duration)

        // Feed result back to the LLM
        const resultSummary = toolResult.success
          ? `Resultado da ferramenta ${toolName}:\n${toolResult.summary}\n\nDados:\n${JSON.stringify(toolResult.data, null, 2).slice(0, 6000)}`
          : `Erro na ferramenta ${toolName}: ${toolResult.error}`

        currentMessage = resultSummary
      } catch (parseError) {
        const errorMsg = 'Erro ao processar chamada de ferramenta.'
        callbacks.onToken(`\n${errorMsg}\n`)
        currentMessage = `Erro: formato de tool_call invalido. Responda diretamente ao usuario sem usar ferramentas.`
      }
    } else {
      // No tool call - this is the final response
      fullResponse += iterResponse
      callbacks.onToken(iterResponse)
      break
    }
  }

  return fullResponse
}
