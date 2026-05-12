/**
 * POST /api/reports/owner/[id]/share
 * Gera (ou revoga) o token público de compartilhamento.
 * Body: { revoke?: boolean, expires_in_days?: number }
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getOwnerReport, updateOwnerReport } from "@/lib/owner-report/repository"
import { generateShareToken, shareUrl } from "@/lib/owner-report/share-token"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let email: string | null = null
  try {
    const session = await getServerSession(authOptions)
    email = session?.user?.email || null
  } catch {}
  if (!email) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const row = await getOwnerReport(params.id)
  if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  if (row.created_by_email !== email) {
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 })
  }

  let body: { revoke?: boolean; expires_in_days?: number } = {}
  try {
    body = await req.json()
  } catch {}

  if (body.revoke) {
    const updated = await updateOwnerReport(params.id, {
      share_token: null,
      share_expires_at: null,
    })
    return NextResponse.json({ success: true, data: { share_token: null }, report: updated })
  }

  const token = generateShareToken()
  const days = body.expires_in_days ?? 30
  const expires = new Date(Date.now() + days * 86_400_000).toISOString()

  const updated = await updateOwnerReport(params.id, {
    share_token: token,
    share_expires_at: expires,
  })

  const origin = new URL(req.url).origin
  return NextResponse.json({
    success: true,
    data: {
      share_token: token,
      share_url: shareUrl(origin, params.id, token),
      expires_at: expires,
    },
    report: updated,
  })
}
