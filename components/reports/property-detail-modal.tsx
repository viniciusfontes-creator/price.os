"use client"

import { useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ExternalLink, Lightbulb, Calendar, AlertTriangle, ArrowRight } from "lucide-react"
import { formatCurrency, getMonthName, getStatusLabel, formatDateBR } from "@/lib/calculations"
import type { MonthlyReportPayload } from "@/types"

interface PropertyDetailModalProps {
  propertyId: string | null
  payload: MonthlyReportPayload
  onClose: () => void
}

const STATUS_BADGE: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 border-emerald-200",
  B: "bg-blue-100 text-blue-700 border-blue-200",
  C: "bg-amber-100 text-amber-700 border-amber-200",
  D: "bg-orange-100 text-orange-700 border-orange-200",
  E: "bg-red-100 text-red-700 border-red-200",
}

const DAY_BG: Record<string, string> = {
  ocupado: "bg-emerald-100 text-emerald-800 border-emerald-300",
  disponivel: "bg-red-50 text-red-700 border-red-200",
  manutencao: "bg-amber-100 text-amber-800 border-amber-300",
  block: "bg-slate-200 text-slate-700 border-slate-300",
}

const DAY_LABEL: Record<string, string> = {
  ocupado: "Ocupado",
  disponivel: "Disponível",
  manutencao: "Manutenção",
  block: "Bloqueio",
}

const TIPO_GAP: Record<string, { label: string; cls: string }> = {
  fds_livre: { label: "FDS Livre", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  intervalo_3a5: { label: "3-5 dias", cls: "bg-blue-100 text-blue-800 border-blue-200" },
  intervalo_longo: { label: "+5 dias", cls: "bg-red-100 text-red-800 border-red-200" },
}

export function PropertyDetailModal({ propertyId, payload, onClose }: PropertyDetailModalProps) {
  const data = useMemo(() => {
    if (!propertyId) return null
    const item = payload.itensPropriedade.find((i) => i.propertyId === propertyId)
    if (!item) return null
    const ocupacao = payload.ocupacao.find((o) => o.propertyId === propertyId)
    const gaps = payload.gaps.filter((g) => g.propertyId === propertyId)
    const quickWin = payload.quickWins.find((q) => q.propertyId === propertyId)
    return { item, ocupacao, gaps, quickWin }
  }, [propertyId, payload])

  if (!propertyId || !data) return null

  const { item, ocupacao, gaps, quickWin } = data
  const [yStr, mStr] = payload.mes.split("-")
  const monthLabel = `${getMonthName(Number.parseInt(mStr, 10))} ${yStr}`
  const stayUrl = item.sub_grupo ? `https://beto.stays.com.br/i/apartment/${item.sub_grupo}` : null

  const firstDate = new Date(`${payload.mes}-01T00:00:00Z`)
  const firstDow = (firstDate.getUTCDay() + 6) % 7
  const dayCells: Array<{ date: string; status: string } | null> = []
  for (let i = 0; i < firstDow; i++) dayCells.push(null)
  for (const d of ocupacao?.dias || []) dayCells.push(d)

  return (
    <Dialog open={!!propertyId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <span className="truncate">{item.nome}</span>
                {stayUrl && (
                  <a
                    href={stayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                    title="Abrir no Stays"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 flex-wrap pt-1">
                <span>{item.praca}</span>
                <span>·</span>
                <span>{item.grupo_nome}</span>
                <span>·</span>
                <Badge variant="outline" className={`${STATUS_BADGE[item.status] || ""} text-[10px]`}>
                  Status {item.status} — {getStatusLabel(item.status)}
                </Badge>
                <span>·</span>
                <span className="font-medium">{monthLabel}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Meta do Mês" value={formatCurrency(item.meta)} />
            <Kpi
              label="OTB"
              value={formatCurrency(item.otb)}
              sub={`${item.pctMeta.toFixed(0)}% da meta`}
              accent={item.pctMeta >= 100 ? "green" : item.pctMeta >= 50 ? "amber" : "red"}
            />
            <Kpi
              label="Gap"
              value={formatCurrency(item.meta - item.otb)}
              accent={item.meta - item.otb > 0 ? "red" : "green"}
            />
            <Kpi label="Reservas" value={String(item.nReservas)} sub={`${item.noites} noites`} />
            <Kpi label="Ticket Médio" value={formatCurrency(item.ticketMedio)} />
            <Kpi label="ADR (OTB)" value={formatCurrency(item.adr)} />
            <Kpi label="Preço Atual" value={formatCurrency(item.precoAtual)} />
            <Kpi label="Canal Principal" value={item.canalMaior || "—"} />
          </div>

          {ocupacao && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <h4 className="text-sm font-semibold uppercase tracking-wider text-primary">
                  Calendário de {monthLabel}
                </h4>
                <Badge variant="outline" className="ml-auto text-[10px]">
                  Ocupação prevista: {ocupacao.ocupacaoPct}% · {ocupacao.noitesVendidas} noites
                  vendidas / {ocupacao.noitesDisponiveis} livres
                </Badge>
              </div>
              <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                  <div
                    key={d}
                    className="text-center text-[11px] font-medium text-muted-foreground py-1"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {dayCells.map((cell, idx) =>
                  cell ? (
                    <div
                      key={cell.date}
                      title={`${formatDateBR(cell.date)} — ${DAY_LABEL[cell.status] || cell.status}`}
                      className={`flex flex-col items-center justify-center rounded-md py-2 px-1 border ${
                        DAY_BG[cell.status] || "bg-muted"
                      }`}
                    >
                      <span className="text-xs font-medium">
                        {Number.parseInt(cell.date.split("-")[2], 10)}
                      </span>
                      <span className="text-[9px] uppercase">
                        {DAY_LABEL[cell.status]?.slice(0, 4) || ""}
                      </span>
                    </div>
                  ) : (
                    <div key={`empty-${idx}`} className="opacity-25 pointer-events-none" />
                  )
                )}
              </div>
              <div className="flex items-center justify-center gap-3 mt-3 text-[10px] text-muted-foreground flex-wrap">
                <Legend cls="bg-emerald-100" label="Ocupado" />
                <Legend cls="bg-red-50" label="Disponível" />
                <Legend cls="bg-amber-100" label="Manutenção" />
                <Legend cls="bg-slate-200" label="Bloqueio" />
              </div>
            </div>
          )}

          {quickWin && (
            <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-600" />
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-amber-900">
                    Recomendação Acionável
                  </h4>
                </div>
                <Badge variant="outline" className="bg-white">
                  {quickWin.tipo}
                </Badge>
              </div>
              <p className="text-sm text-foreground mb-3">{quickWin.recomendacao}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Preço Atual</p>
                  <p className="font-semibold">{formatCurrency(quickWin.precoAtual)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Preço Sugerido</p>
                  <p className="font-semibold text-emerald-700">
                    {formatCurrency(quickWin.precoSugerido)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Noites p/ Vender</p>
                  <p className="font-semibold">{quickWin.noitesRestantes}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Impacto Estimado</p>
                  <p className="font-bold text-emerald-700">{formatCurrency(quickWin.impactoR$)}</p>
                </div>
              </div>
            </div>
          )}

          {gaps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h4 className="text-sm font-semibold uppercase tracking-wider text-primary">
                  Gaps de Calendário
                </h4>
                <Badge variant="secondary" className="ml-auto">
                  {gaps.length}
                </Badge>
              </div>
              <div className="space-y-1.5">
                {gaps.map((g, i) => (
                  <div
                    key={`${g.inicio}-${i}`}
                    className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-xs"
                  >
                    <span>
                      {formatDateBR(g.inicio)} → {formatDateBR(g.fim)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${TIPO_GAP[g.tipo].cls}`}>
                        {TIPO_GAP[g.tipo].label}
                      </Badge>
                      <span className="font-semibold tabular-nums">
                        {g.nights} {g.nights === 1 ? "noite" : "noites"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <div className="flex flex-col sm:flex-row gap-2 justify-end">
            <Button variant="outline" asChild>
              <a
                href={`/vendas?propertyId=${item.propertyId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Inteligência de Vendas <ArrowRight className="h-3 w-3 ml-1" />
              </a>
            </Button>
            {stayUrl && (
              <Button variant="outline" asChild>
                <a href={stayUrl} target="_blank" rel="noopener noreferrer">
                  Abrir no Stays <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
            <Button onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: "green" | "red" | "amber"
}) {
  const valueColor =
    accent === "green"
      ? "text-emerald-700"
      : accent === "red"
      ? "text-red-700"
      : accent === "amber"
      ? "text-amber-700"
      : "text-foreground"
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</p>
      <p className={`text-base font-bold tabular-nums truncate ${valueColor}`} title={value}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`w-3 h-3 rounded ${cls}`} /> {label}
    </span>
  )
}
