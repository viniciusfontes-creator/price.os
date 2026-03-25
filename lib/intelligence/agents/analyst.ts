// ============================================
// ANALYST AGENT - Revenue & Performance
// ============================================

import { GoogleGenerativeAI } from '@google/generative-ai'
import type { BaseAgent } from './base-agent'
import { getAgentTools, buildAgentSystemPrompt } from './base-agent'
import type { AgentContext, StreamCallback, ToolDefinition, ToolResult } from '../types'
import { AGENT_PROMPTS } from '../prompts'
import { getAllTools } from '../tools/tool-registry'
import { getToolByName } from '../tools/tool-registry'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')

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
    model: 'gemini-flash-latest',
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
  const maxIterations = 5 // Reduced from 8 to conserve API quota
  let currentMessage = message

  // Tool call cache to prevent duplicate calls within the same request
  const toolCallCache = new Map<string, { result: ToolResult; duration: number }>()

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

        // Check cache for duplicate tool calls
        const cacheKey = `${toolName}::${JSON.stringify(toolArgs)}`
        const cached = toolCallCache.get(cacheKey)

        let toolResult: ToolResult
        let duration: number

        if (cached) {
          // Return cached result instead of calling again
          toolResult = cached.result
          duration = 0
          callbacks.onToolResult(toolName, toolResult, duration)
        } else {
          // Execute tool
          const startTime = Date.now()
          toolResult = await toolDef.execute(toolArgs, context)
          duration = Date.now() - startTime
          // Cache the result
          toolCallCache.set(cacheKey, { result: toolResult, duration })
          callbacks.onToolResult(toolName, toolResult, duration)
        }

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

  // If the loop ended after tool calls without a final text response, force one
  if (iterations >= maxIterations && !fullResponse.trim()) {
    try {
      const finalResult = await chat.sendMessageStream(
        'Voce atingiu o limite de iteracoes. Com base em TODOS os dados que voce ja coletou das ferramentas, forneca agora sua resposta final completa ao usuario. NAO chame mais ferramentas. Responda diretamente.'
      )
      let finalText = ''
      for await (const chunk of finalResult.stream) {
        finalText += chunk.text()
      }
      // Remove any accidental tool calls from the forced response
      finalText = finalText.replace(/```tool_call[\s\S]*?```/g, '').trim()
      if (finalText) {
        fullResponse += finalText
        callbacks.onToken(finalText)
      }
    } catch {
      // If even this fails, provide a fallback
      const fallback = '\n\nOs dados foram coletados com sucesso pelas ferramentas acima. Por favor, refine sua pergunta para que eu possa apresentar uma analise mais detalhada.'
      fullResponse += fallback
      callbacks.onToken(fallback)
    }
  }

  return fullResponse
}
