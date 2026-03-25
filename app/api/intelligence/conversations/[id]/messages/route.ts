import { type NextRequest, NextResponse } from 'next/server'
import { getConversationMessages } from '@/lib/intelligence/memory'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)

    const messages = await getConversationMessages(id, limit, offset)
    return NextResponse.json({ success: true, data: messages })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar mensagens' },
      { status: 500 }
    )
  }
}
