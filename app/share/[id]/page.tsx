/**
 * Página pública de visualização de relatório compartilhado.
 * URL: /share/[id]?token=<share_token>
 *
 * Rota de topo, fora do (dashboard), excluída do middleware de auth.
 * Token é validado server-side ao carregar.
 */

import { notFound } from "next/navigation"
import { getOwnerReport } from "@/lib/owner-report/repository"
import { validateShare } from "@/lib/owner-report/share-token"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface Props {
  params: { id: string }
  searchParams: { token?: string }
}

export default async function SharePage({ params, searchParams }: Props) {
  const token = searchParams.token || null
  const row = await getOwnerReport(params.id)
  if (!row) notFound()

  const check = validateShare(token, row.share_token, row.share_expires_at)
  if (!check.valid) {
    return (
      <div className="max-w-md mx-auto py-24 text-center px-6">
        <h1 className="text-xl font-semibold">Link inválido ou expirado</h1>
        <p className="text-sm text-neutral-500 mt-2">
          Solicite um novo link à equipe Quarto à Vista.
        </p>
      </div>
    )
  }

  const pdfUrl = `/api/reports/owner/${params.id}/pdf-public?token=${encodeURIComponent(token!)}`

  return (
    <div className="min-h-screen bg-[#FBF9F4] flex flex-col">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- raw img é suficiente p/ logo simples */}
          <img
            src="/brand/quarto-a-vista.png"
            alt="Quarto à Vista"
            style={{ height: 28, width: "auto" }}
          />
          <div className="hidden sm:block">
            <h1 className="text-sm font-semibold">{row.nome_propriedade}</h1>
            <p className="text-xs text-neutral-500">
              Relatório do proprietário · {row.periodo_inicio} → {row.periodo_fim}
            </p>
          </div>
        </div>
        <a
          href={pdfUrl}
          download
          className="text-sm px-3 py-1.5 rounded-md bg-sky-500 text-white font-medium hover:bg-sky-600"
        >
          Baixar PDF
        </a>
      </header>
      <main className="flex-1 flex">
        <iframe
          src={pdfUrl}
          title="Relatório"
          className="w-full flex-1 border-0 bg-white"
          style={{ minHeight: "calc(100vh - 60px)" }}
        />
      </main>
    </div>
  )
}
