import { type NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createConversation, getConversations } from '@/lib/intelligence/memory'

export async function GET() {
  try {
    let userEmail = 'anonymous'
    try {
      const session = await getServerSession(authOptions)
      userEmail = session?.user?.email || 'anonymous'
    } catch {
      // continue as anonymous
    }

    const conversations = await getConversations(userEmail)
    return NextResponse.json({ success: true, data: conversations })
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar conversas' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    let userEmail = 'anonymous'
    try {
      const session = await getServerSession(authOptions)
      userEmail = session?.user?.email || 'anonymous'
    } catch {
      // continue as anonymous
    }

    const { title } = await request.json().catch(() => ({ title: undefined }))
    const id = await createConversation(userEmail, title)

    if (!id) {
      return NextResponse.json(
        { error: 'Falha ao criar conversa' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: { id, title: title || 'Nova conversa' } })
  } catch (error) {
    console.error('Error creating conversation:', error)
    return NextResponse.json(
      { error: 'Erro ao criar conversa' },
      { status: 500 }
    )
  }
}
