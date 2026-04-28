"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, AlertCircle, Crown } from "lucide-react"
import type { RankRow } from "@/types"
import { formatCurrency } from "@/lib/calculations"

interface RankingsSectionProps {
  topOTB: RankRow[]
  overMeta: RankRow[]
  emRisco: RankRow[]
  onSelectProperty?: (propertyId: string) => void
}

const STATUS_BADGE: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 border-emerald-200",
  B: "bg-blue-100 text-blue-700 border-blue-200",
  C: "bg-amber-100 text-amber-700 border-amber-200",
  D: "bg-orange-100 text-orange-700 border-orange-200",
  E: "bg-red-100 text-red-700 border-red-200",
}

function RankBadge({ position }: { position: number }) {
  const colors =
    position === 1
      ? "bg-amber-100 text-amber-800 border-amber-300"
      : position === 2
      ? "bg-slate-100 text-slate-700 border-slate-300"
      : position === 3
      ? "bg-orange-100 text-orange-700 border-orange-300"
      : "bg-muted text-muted-foreground border-border"
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full border text-[11px] font-bold tabular-nums ${colors}`}
    >
      {position}
    </span>
  )
}

function RankingCard({
  title,
  icon: Icon,
  iconColor,
  rows,
  emptyText,
  showGap,
  onSelect,
}: {
  title: string
  icon: React.ElementType
  iconColor: string
  rows: RankRow[]
  emptyText: string
  showGap?: boolean
  onSelect?: (propertyId: string) => void
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{emptyText}</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div
                key={row.propertyId}
                onClick={() => onSelect?.(row.propertyId)}
                className={`flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 transition-colors ${
                  onSelect ? "cursor-pointer hover:bg-muted/50" : ""
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <RankBadge position={i + 1} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{row.nome}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {row.praca} · {row.nReservas} {row.nReservas === 1 ? "reserva" : "reservas"}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums">{formatCurrency(showGap ? row.gap : row.otb)}</p>
                  <div className="flex items-center justify-end gap-1.5">
                    <Badge variant="outline" className={`text-[9px] ${STATUS_BADGE[row.status] || ""}`}>
                      {row.status}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground tabular-nums">{row.pctMeta.toFixed(0)}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function RankingsSection({ topOTB, overMeta, emRisco, onSelectProperty }: RankingsSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <RankingCard
        title="Top 10 OTB"
        icon={Trophy}
        iconColor="text-amber-600"
        rows={topOTB}
        emptyText="Sem OTB no período."
        onSelect={onSelectProperty}
      />
      <RankingCard
        title="Over Meta (≥100%)"
        icon={Crown}
        iconColor="text-emerald-600"
        rows={overMeta}
        emptyText="Nenhuma unidade ainda atingiu 100% da meta com OTB."
        onSelect={onSelectProperty}
      />
      <RankingCard
        title="Em Risco (Maior Gap)"
        icon={AlertCircle}
        iconColor="text-red-600"
        rows={emRisco}
        emptyText="Nenhuma unidade abaixo de 50% da meta."
        showGap
        onSelect={onSelectProperty}
      />
    </div>
  )
}
