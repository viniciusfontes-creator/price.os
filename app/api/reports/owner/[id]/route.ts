/**
 * /api/reports/owner/[id]
 *  - GET:   carrega um relatório
 *  - PATCH: atualiza slides / status (auto-save do editor)
 */

import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import {
  getOwnerReport,
  updateOwnerReport,
  type UpdateOwnerReportInput,
} from "@/lib/owner-report/repository"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function getEmail(): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions)
    return session?.user?.email || null
  } catch {
    return null
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const email = await getEmail()
  if (!email) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const row = await getOwnerReport(params.id)
  if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  if (row.created_by_email !== email) {
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 })
  }
  return NextResponse.json({ success: true, data: row })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const email = await getEmail()
  if (!email) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const row = await getOwnerReport(params.id)
  if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  if (row.created_by_email !== email) {
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 })
  }

  let body: UpdateOwnerReportInput = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 })
  }

  // whitelist explícito — não deixa caller mexer em snapshot, created_by, etc.
  const patch: UpdateOwnerReportInput = {}
  if (body.slides !== undefined) patch.slides = body.slides
  if (body.status !== undefined) patch.status = body.status
  if (body.pdf_url !== undefined) patch.pdf_url = body.pdf_url
  if (body.share_token !== undefined) patch.share_token = body.share_token
  if (body.share_expires_at !== undefined) patch.share_expires_at = body.share_expires_at

  try {
    const updated = await updateOwnerReport(params.id, patch)
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error("[owner-report] patch error:", err)
    return NextResponse.json(
      { error: "Falha ao atualizar", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
