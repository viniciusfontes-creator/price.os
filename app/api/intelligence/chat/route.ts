import { type NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { Orchestrator } from '@/lib/intelligence/orchestrator'
import {
  createConversation,
  getConversationMessages,
  saveMessage,
  updateConversationTitle,
  getRelevantMemories,
} from '@/lib/intelligence/memory'
import { createSSEStream } from '@/lib/intelligence/stream-utils'
import type { StreamEvent } from '@/types/intelligence'
import type { ToolCallRecord } from '@/types/intelligence'

// Rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Limite de requisicoes atingido. Aguarde um minuto.' },
        { status: 429 }
      )
    }

    // Auth check
    let userEmail = 'anonymous'
    try {
      const session = await getServerSession(authOptions)
      userEmail = session?.user?.email || 'anonymous'
    } catch {
      // Auth not available, continue as anonymous
    }

    // Parse request
    const { conversationId, message } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Mensagem obrigatoria' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY nao configurada' },
        { status: 500 }
      )
    }

    // Create or use existing conversation
    let convId = conversationId
    let isNewConversation = false
    if (!convId) {
      convId = await createConversation(userEmail)
      isNewConversation = true
    }

    if (!convId) {
      return NextResponse.json(
        { error: 'Falha ao criar conversa' },
        { status: 500 }
      )
    }

    // Save user message
    await saveMessage(convId, 'user', message)

    // Load context
    const [history, memories] = await Promise.all([
      getConversationMessages(convId, 20),
      getRelevantMemories(userEmail, 10),
    ])

    return createSSEStream(async (send: (event: StreamEvent) => void) => {
      const orchestrator = new Orchestrator()
      const toolCalls: ToolCallRecord[] = []

      // Send metadata
      send({
        type: 'metadata',
        data: { conversationId: convId, isNew: isNewConversation },
      })

      // Process message through orchestrator
      const { content, agentId } = await orchestrator.processMessage(
        message,
        {
          userEmail,
          conversationHistory: history.map((m) => ({
            role: m.role,
            content: m.content,
            agent_id: m.agent_id as any,
          })),
          memories,
        },
        {
          onToken: (token) => {
            send({ type: 'token', data: { content: token } })
          },
          onToolStart: (toolName, args) => {
            send({ type: 'tool_start', data: { toolName, args } })
          },
          onToolResult: (toolName, result, durationMs) => {
            toolCalls.push({
              tool_name: toolName,
              arguments: {},
              result: result.summary,
              duration_ms: durationMs,
              status: result.success ? 'success' : 'error',
            })
            send({
              type: 'tool_result',
              data: { toolName, summary: result.summary, success: result.success, durationMs },
            })
          },
          onGatekeeper: (action) => {
            send({ type: 'gatekeeper', data: action as any })
          },
          onAgentSwitch: (from, to, reason) => {
            send({ type: 'agent_switch', data: { from, to, reason } })
          },
          onError: (error) => {
            send({ type: 'error', data: { message: error } })
          },
        }
      )

      // Save assistant message
      await saveMessage(
        convId!,
        'assistant',
        content,
        agentId,
        toolCalls.length > 0 ? toolCalls : null
      )

      // Generate title for new conversations
      if (isNewConversation && content) {
        const title = await orchestrator.generateTitle(message, content)
        await updateConversationTitle(convId!, title)
        send({ type: 'done', data: { conversationId: convId, title, agentId } })
      } else {
        send({ type: 'done', data: { conversationId: convId, agentId } })
      }
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('Intelligence chat error:', errMsg, error)
    return NextResponse.json(
      { error: `Erro interno: ${errMsg}` },
      { status: 500 }
    )
  }
}
