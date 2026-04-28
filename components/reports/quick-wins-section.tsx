"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowDown, ArrowUp, CheckCircle2, ExternalLink, Lightbulb, TrendingDown, TrendingUp } from "lucide-react"
import type { QuickWin } from "@/types"
import { formatCurrency } from "@/lib/calculations"

interface QuickWinsSectionProps {
  wins: QuickWin[]
  onSelectProperty?: (propertyId: string) => void
}

const TIPO_META = {
  OVERPRICED: {
    title: "Sobreprecificado",
    sub: "Reduzir preço para liberar ocupação",
    icon: TrendingDown,
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    arrow: ArrowDown,
  },
  UNDERPRICED: {
    title: "Subprecificado",
    sub: "Subir preço — alta ocupação",
    icon: TrendingUp,
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    arrow: ArrowUp,
  },
  ALIGNED: {
    title: "Alinhado",
    sub: "Foco em volume / canal",
    icon: CheckCircle2,
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    arrow: CheckCircle2,
  },
} as const

const PRIORIDADE_LABEL: Record<number, { label: string; cls: string }> = {
  1: { label: "Alta", cls: "bg-red-100 text-red-700 border-red-200" },
  2: { label: "Média", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  3: { label: "Baixa", cls: "bg-slate-100 text-slate-700 border-slate-200" },
}

function WinCard({ win, onSelect }: { win: QuickWin; onSelect?: (id: string) => void }) {
  const meta = TIPO_META[win.tipo]
  const Arrow = meta.arrow
  const stayUrl = win.sub_grupo
    ? `https://beto.stays.com.br/i/apartment/${win.sub_grupo}`
    : null

  return (
    <div
      onClick={() => onSelect?.(win.propertyId)}
      className={`rounded-lg border-2 ${meta.border} ${meta.bg} p-3 space-y-2 ${
        onSelect ? "cursor-pointer hover:shadow-sm transition-shadow" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-semibold text-sm text-foreground truncate" title={win.nome}>
              {win.nome}
            </span>
            {stayUrl && (
              <a
                href={stayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {win.praca} · {win.grupo_nome} · Status {win.status}
          </p>
        </div>
        <Badge variant="outline" className={`text-[10px] ${PRIORIDADE_LABEL[win.prioridade].cls}`}>
          {PRIORIDADE_LABEL[win.prioridade].label}
        </Badge>
      </div>

      <p className="text-xs text-foreground leading-snug flex items-start gap-1">
        <Arrow className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${meta.color}`} />
        <span>{win.recomendacao}</span>
      </p>

      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/50">
        <div>
          <p className="text-[10px] text-muted-foreground">Ocupação</p>
          <p className="text-xs font-semibold">{win.ocupacaoOTB.toFixed(0)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Gap</p>
          <p className="text-xs font-semibold">{formatCurrency(win.gap)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Impacto</p>
          <p className={`text-xs font-bold ${meta.color}`}>{formatCurrency(win.impactoR$)}</p>
        </div>
      </div>
    </div>
  )
}

export function QuickWinsSection({ wins, onSelectProperty }: QuickWinsSectionProps) {
  const [expanded, setExpanded] = useState(false)

  const grouped = useMemo(() => {
    return {
      OVERPRICED: wins.filter((w) => w.tipo === "OVERPRICED"),
      UNDERPRICED: wins.filter((w) => w.tipo === "UNDERPRICED"),
      ALIGNED: wins.filter((w) => w.tipo === "ALIGNED"),
    }
  }, [wins])

  const totalImpacto = wins.reduce((s, w) => s + w.impactoR$, 0)
  const limit = expanded ? 50 : 5

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base">Quick-Wins Acionáveis</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              {wins.length} oportunidades · Impacto total estimado:{" "}
              <span className="font-semibold text-emerald-700">{formatCurrency(totalImpacto)}</span>
            </p>
            {wins.length > 5 && (
              <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)} className="h-7 text-xs">
                {expanded ? "Mostrar menos" : "Ver todas"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(["UNDERPRICED", "OVERPRICED", "ALIGNED"] as const).map((tipo) => {
            const meta = TIPO_META[tipo]
            const list = grouped[tipo].slice(0, limit)
            const Icon = meta.icon
            return (
              <div key={tipo} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${meta.bg} ${meta.border} border`}>
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{meta.title}</p>
                    <p className="text-[11px] text-muted-foreground">{meta.sub}</p>
                  </div>
                  <Badge variant="secondary">{grouped[tipo].length}</Badge>
                </div>
                {list.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Nenhuma oportunidade neste grupo.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {list.map((w) => (
                      <WinCard key={`${tipo}-${w.propertyId}`} win={w} onSelect={onSelectProperty} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
