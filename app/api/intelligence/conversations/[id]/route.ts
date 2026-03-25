import { type NextRequest, NextResponse } from 'next/server'
import {
  getConversationMessages,
  updateConversationTitle,
  deleteConversation,
} from '@/lib/intelligence/memory'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const messages = await getConversationMessages(id, 100)
    return NextResponse.json({ success: true, data: messages })
  } catch (error) {
    console.error('Error fetching conversation:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar conversa' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { title } = await request.json()

    if (!title) {
      return NextResponse.json({ error: 'Titulo obrigatorio' }, { status: 400 })
    }

    await updateConversationTitle(id, title)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating conversation:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar conversa' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const success = await deleteConversation(id)

    if (!success) {
      return NextResponse.json(
        { error: 'Falha ao deletar conversa' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting conversation:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar conversa' },
      { status: 500 }
    )
  }
}
