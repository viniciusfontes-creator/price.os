// ============================================
// SSE STREAMING UTILITIES
// ============================================

import type { StreamEvent } from '@/types/intelligence'

export function createSSEStream(
  handler: (send: (event: StreamEvent) => void) => Promise<void>
): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
        controller.enqueue(encoder.encode(data))
      }

      try {
        await handler(send)
      } catch (error) {
        send({
          type: 'error',
          data: { message: error instanceof Error ? error.message : 'Erro interno do servidor' },
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

/**
 * Parse SSE events from a ReadableStream on the client side
 */
export async function* parseSSEStream(
  response: Response
): AsyncGenerator<StreamEvent> {
  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    let currentEvent = ''
    let currentData = ''

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7)
      } else if (line.startsWith('data: ')) {
        currentData = line.slice(6)
      } else if (line === '' && currentEvent && currentData) {
        try {
          yield {
            type: currentEvent as StreamEvent['type'],
            data: JSON.parse(currentData),
          }
        } catch {
          // Skip malformed events
        }
        currentEvent = ''
        currentData = ''
      }
    }
  }
}
