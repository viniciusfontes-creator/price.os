"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, AlertTriangle } from "lucide-react"
import type { Gap } from "@/types"
import { formatDateBR } from "@/lib/calculations"

const TIPO_META: Record<Gap["tipo"], { label: string; cls: string }> = {
  fds_livre: { label: "FDS Livre", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  intervalo_3a5: { label: "3-5 dias", cls: "bg-blue-100 text-blue-800 border-blue-200" },
  intervalo_longo: { label: "+5 dias", cls: "bg-red-100 text-red-800 border-red-200" },
}

interface GapsListProps {
  gaps: Gap[]
  onSelectProperty?: (propertyId: string) => void
}

export function GapsList({ gaps, onSelectProperty }: GapsListProps) {
  const [showAll, setShowAll] = useState(false)
  const [filter, setFilter] = useState<Gap["tipo"] | "all">("all")

  const filtered = useMemo(() => {
    return filter === "all" ? gaps : gaps.filter((g) => g.tipo === filter)
  }, [gaps, filter])

  const sorted = useMemo(() => [...filtered].sort((a, b) => b.nights - a.nights), [filtered])
  const visible = showAll ? sorted : sorted.slice(0, 12)

  const counts = {
    all: gaps.length,
    fds_livre: gaps.filter((g) => g.tipo === "fds_livre").length,
    intervalo_3a5: gaps.filter((g) => g.tipo === "intervalo_3a5").length,
    intervalo_longo: gaps.filter((g) => g.tipo === "intervalo_longo").length,
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base">Gaps de Calendário</CardTitle>
          </div>
          <Badge variant="secondary">{gaps.length} gaps</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Intervalos vagos detectados no calendário do mês — oportunidades de venda focada.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            className="h-7 text-xs"
          >
            Todos · {counts.all}
          </Button>
          <Button
            variant={filter === "fds_livre" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("fds_livre")}
            className="h-7 text-xs"
          >
            FDS Livre · {counts.fds_livre}
          </Button>
          <Button
            variant={filter === "intervalo_3a5" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("intervalo_3a5")}
            className="h-7 text-xs"
          >
            3-5 dias · {counts.intervalo_3a5}
          </Button>
          <Button
            variant={filter === "intervalo_longo" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("intervalo_longo")}
            className="h-7 text-xs"
          >
            +5 dias · {counts.intervalo_longo}
          </Button>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum gap encontrado para este filtro.
          </div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {visible.map((g, idx) => (
              <div
                key={`${g.propertyId}-${g.inicio}-${idx}`}
                onClick={() => onSelectProperty?.(g.propertyId)}
                className={`flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between transition-colors ${
                  onSelectProperty ? "cursor-pointer hover:bg-muted/50" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{g.nome}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {g.praca} · <Calendar className="inline h-3 w-3" /> {formatDateBR(g.inicio)} →{" "}
                    {formatDateBR(g.fim)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={`text-[10px] ${TIPO_META[g.tipo].cls}`}>
                    {TIPO_META[g.tipo].label}
                  </Badge>
                  <span className="text-xs font-semibold tabular-nums">
                    {g.nights} {g.nights === 1 ? "noite" : "noites"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {sorted.length > 12 && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)} className="w-full">
            {showAll ? "Mostrar menos" : `Ver todos os ${sorted.length} gaps`}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
