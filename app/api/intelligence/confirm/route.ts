import { type NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { logGatekeeperAction, saveMessage } from '@/lib/intelligence/memory'

export async function POST(request: NextRequest) {
  try {
    let userEmail: string | undefined
    try {
      const session = await getServerSession(authOptions)
      userEmail = session?.user?.email || undefined
    } catch {
      // Auth not available
    }

    if (!userEmail) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const { actionId, conversationId, decision, actionType, actionDescription, actionPayload, impactSummary } =
      await request.json()

    if (!actionId || !conversationId || !decision) {
      return NextResponse.json(
        { error: 'actionId, conversationId e decision sao obrigatorios' },
        { status: 400 }
      )
    }

    if (!['approved', 'rejected', 'modified'].includes(decision)) {
      return NextResponse.json(
        { error: 'decision deve ser approved, rejected ou modified' },
        { status: 400 }
      )
    }

    // Log the gatekeeper decision
    await logGatekeeperAction(conversationId, userEmail, {
      actionType: actionType || 'unknown',
      actionDescription: actionDescription || 'Acao do gatekeeper',
      actionPayload: actionPayload || {},
      impactSummary: impactSummary || null,
      decision,
    })

    // Save decision as a system message in the conversation
    const decisionLabel = decision === 'approved' ? 'APROVADA' : decision === 'rejected' ? 'REJEITADA' : 'MODIFICADA'
    await saveMessage(
      conversationId,
      'system',
      `Acao ${decisionLabel} pelo usuario: ${actionDescription || actionType || 'acao do gatekeeper'}`,
      null
    )

    // In Phase 1, no actual writes are executed
    // Just return success with the decision
    return NextResponse.json({
      success: true,
      data: {
        actionId,
        decision,
        message:
          decision === 'approved'
            ? 'Acao aprovada. Em fase 1, recomendacoes sao apenas informativas - nenhuma alteracao foi executada.'
            : decision === 'rejected'
              ? 'Acao rejeitada pelo usuario.'
              : 'Acao modificada e registrada.',
      },
    })
  } catch (error) {
    console.error('Gatekeeper confirm error:', error)
    return NextResponse.json(
      { error: 'Erro ao processar confirmacao' },
      { status: 500 }
    )
  }
}
