"use client"

import * as React from "react"
import Link from "next/link"
import { FileText, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TableSkeleton } from "@/components/page-skeleton"

interface ReportRow {
  id: string
  nome_propriedade: string | null
  idpropriedade: string
  periodo_inicio: string
  periodo_fim: string
  status: string
  created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
}

export default function HistoricoRelatoriosPage() {
  const [reports, setReports] = React.useState<ReportRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch("/api/reports/owner")
      .then((r) => r.json())
      .then((j) => (j.success ? setReports(j.data) : setError(j.error || "Falha ao listar")))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-5xl mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileText className="h-6 w-6 text-sky-500" />
            Relatórios do Proprietário
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Apresentações em PDF para enviar aos proprietários das unidades.
          </p>
        </div>
        <Button asChild>
          <Link href="/proprietarios/apresentacao/novo">
            <Plus className="h-4 w-4 mr-2" /> Novo relatório
          </Link>
        </Button>
      </div>

      {loading && <TableSkeleton rows={6} />}
      {error && <p className="text-destructive">{error}</p>}

      {!loading && !error && reports.length === 0 && (
        <div className="text-center py-16 rounded-lg border border-dashed">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum relatório criado ainda.</p>
          <Button asChild className="mt-4">
            <Link href="/proprietarios/apresentacao/novo">Criar o primeiro</Link>
          </Button>
        </div>
      )}

      {!loading && reports.length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Unidade</th>
                <th className="text-left px-4 py-2 font-medium">Período</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Criado em</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/proprietarios/apresentacao/${r.id}`} className="hover:underline">
                      {r.nome_propriedade || r.idpropriedade}
                    </Link>
                    <div className="text-xs text-muted-foreground">{r.idpropriedade}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.periodo_inicio} → {r.periodo_fim}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{STATUS_LABEL[r.status] || r.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/proprietarios/apresentacao/${r.id}`}>Abrir</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
