/**
 * /api/reports/owner
 *  - POST: cria um rascunho (carrega BQ + snapshot + persiste)
 *  - GET:  lista relatórios do usuário logado
 */

import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { createDraftReport } from "@/lib/owner-report/service"
import { listOwnerReports } from "@/lib/owner-report/repository"

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

export async function GET() {
  const email = await getEmail()
  if (!email) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  try {
    const rows = await listOwnerReports(email)
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error("[owner-report] list error:", err)
    return NextResponse.json(
      { error: "Falha ao listar relatórios", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const email = await getEmail()
  if (!email) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  let body: { idpropriedade?: string; ini?: string; fim?: string; template_key?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 })
  }

  const { idpropriedade, ini, fim, template_key } = body
  if (!idpropriedade || !ini || !fim) {
    return NextResponse.json(
      { error: "Campos obrigatórios: idpropriedade, ini, fim" },
      { status: 400 }
    )
  }

  try {
    const result = await createDraftReport({
      createdByEmail: email,
      idpropriedade,
      periodo: { ini, fim },
      templateKey: template_key,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true, data: result.report })
  } catch (err) {
    console.error("[owner-report] create error:", err)
    return NextResponse.json(
      { error: "Falha ao criar relatório", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
