// ============================================
// ANALYST AGENT - Revenue & Performance
// ============================================

import type { BaseAgent } from './base-agent'
import { getAgentTools, buildAgentSystemPrompt } from './base-agent'
import type { AgentContext, StreamCallback, ToolDefinition, ToolResult } from '../types'
import { AGENT_PROMPTS } from '../prompts'
import { getAllTools } from '../tools/tool-registry'
import { getToolByName } from '../tools/tool-registry'
import { getOpenRouterClient, GEMINI_MODEL } from '../openrouter-client'

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
  const client = getOpenRouterClient()

  const systemPrompt = buildAgentSystemPrompt(
    AGENT_PROMPTS[agentId],
    tools,
    context.memories
  )

  // Build messages array in OpenAI format
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ]

  // Add conversation history
  for (const m of context.conversationHistory.filter((m) => m.role === 'user' || m.role === 'assistant')) {
    messages.push({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    })
  }

  // Add current message
  messages.push({ role: 'user', content: message })

  let fullResponse = ''
  let iterations = 0
  const maxIterations = 5

  // Tool call cache to prevent duplicate calls within the same request
  const toolCallCache = new Map<string, { result: ToolResult; duration: number }>()

  while (iterations < maxIterations) {
    iterations++

    // Stream response from OpenRouter
    const stream = await client.chat.completions.create({
      model: GEMINI_MODEL,
      temperature: 0.7,
      max_tokens: 4096,
      stream: true,
      messages,
    })

    let iterResponse = ''

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || ''
      iterResponse += delta
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
          // Add assistant message and error to conversation for next iteration
          messages.push({ role: 'assistant', content: iterResponse })
          messages.push({ role: 'user', content: `Erro: ${errorMsg}. Tente outra abordagem.` })
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

        // Check cache for duplicate tool calls
        const cacheKey = `${toolName}::${JSON.stringify(toolArgs)}`
        const cached = toolCallCache.get(cacheKey)

        let toolResult: ToolResult
        let duration: number

        if (cached) {
          toolResult = cached.result
          duration = 0
          callbacks.onToolResult(toolName, toolResult, duration)
        } else {
          const startTime = Date.now()
          toolResult = await toolDef.execute(toolArgs, context)
          duration = Date.now() - startTime
          toolCallCache.set(cacheKey, { result: toolResult, duration })
          callbacks.onToolResult(toolName, toolResult, duration)
        }

        // Feed result back to the LLM by appending to messages
        const resultSummary = toolResult.success
          ? `Resultado da ferramenta ${toolName}:\n${toolResult.summary}\n\nDados:\n${JSON.stringify(toolResult.data, null, 2).slice(0, 6000)}`
          : `Erro na ferramenta ${toolName}: ${toolResult.error}`

        messages.push({ role: 'assistant', content: iterResponse })
        messages.push({ role: 'user', content: resultSummary })
      } catch (parseError) {
        const errorMsg = 'Erro ao processar chamada de ferramenta.'
        callbacks.onToken(`\n${errorMsg}\n`)
        messages.push({ role: 'assistant', content: iterResponse })
        messages.push({ role: 'user', content: `Erro: formato de tool_call invalido. Responda diretamente ao usuario sem usar ferramentas.` })
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
