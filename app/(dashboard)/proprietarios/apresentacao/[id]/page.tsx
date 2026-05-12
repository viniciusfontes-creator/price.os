"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Download, Edit3, FileText, Loader2, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SLIDE_LABELS, type SlideConfig } from "@/lib/owner-report/templates"

interface Report {
  id: string
  nome_propriedade: string | null
  idpropriedade: string
  periodo_inicio: string
  periodo_fim: string
  status: string
  template_key: string
  slides: SlideConfig[]
  snapshot_data: any
  created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [report, setReport] = React.useState<Report | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetch(`/api/reports/owner/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (!j.success) setError(j.error || "Falha ao carregar")
        else setReport(j.data)
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando relatório…
      </div>
    )
  }
  if (error || !report) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <p className="text-destructive">{error || "Relatório não encontrado"}</p>
        <Button variant="ghost" onClick={() => router.push("/proprietarios/apresentacao")} className="mt-4">
          Voltar
        </Button>
      </div>
    )
  }

  const kpis = report.snapshot_data?.resumoExecutivo?.kpis
  const pdfUrl = `/api/reports/owner/${id}/pdf`

  async function handleShare() {
    try {
      const res = await fetch(`/api/reports/owner/${id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expires_in_days: 30 }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) {
        toast.error(j.error || "Falha ao gerar link")
        return
      }
      const url = j.data.share_url as string
      try {
        await navigator.clipboard.writeText(url)
        toast.success("Link copiado", { description: "Válido por 30 dias" })
      } catch {
        toast.info("Link gerado", { description: url })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado")
    }
  }

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/proprietarios/apresentacao"
            className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> Histórico
          </Link>
          <h1 className="text-2xl font-semibold mt-2 flex items-center gap-2">
            <FileText className="h-6 w-6 text-sky-500" />
            {report.nome_propriedade || report.idpropriedade}
          </h1>
          <p className="text-sm text-muted-foreground">
            {report.periodo_inicio} → {report.periodo_fim} ·{" "}
            <Badge variant="outline">{STATUS_LABEL[report.status] || report.status}</Badge>
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/proprietarios/apresentacao/${id}/editar`}>
              <Edit3 className="h-4 w-4 mr-2" /> Editar
            </Link>
          </Button>
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" /> Compartilhar
          </Button>
          <Button asChild>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4 mr-2" /> Baixar PDF
            </a>
          </Button>
        </div>
      </div>

      {kpis && (
        <div className="grid grid-cols-4 gap-3">
          <KpiCell label="Receita" value={brl(kpis.receita)} sub={`${kpis.nReservas} reservas`} />
          <KpiCell label="Ocupação" value={`${Math.round(kpis.ocupacaoPct * 100)}%`} />
          <KpiCell label="ADR" value={brl(kpis.adr)} />
          <KpiCell
            label="Média de hóspedes"
            value={kpis.mediaHospedes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
          />
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-2 border-b text-xs uppercase tracking-wider text-muted-foreground">
          Pré-visualização
        </div>
        <iframe
          src={pdfUrl}
          title="PDF preview"
          className="w-full"
          style={{ height: "calc(100vh - 280px)", minHeight: 600 }}
        />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-medium mb-3">Slides ({report.slides.length})</div>
        <ul className="space-y-1 text-sm">
          {report.slides.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  s.visible ? "bg-sky-500" : "bg-neutral-300"
                }`}
              />
              <span className={s.visible ? "" : "text-muted-foreground line-through"}>
                {SLIDE_LABELS[s.key] || s.key}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-3">
          Editor de textos virá no próximo degrau.
        </p>
      </div>
    </div>
  )
}

function KpiCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums mt-1">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}
