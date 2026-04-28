"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowUpRight, ArrowDownRight, BarChart3 } from "lucide-react"
import { formatCurrency } from "@/lib/calculations"

interface YoYProps {
  baselineLabel: string
  currentLabel: string
  totalBaseline: number
  totalCurrent: number
  deltaPct: number
  porPraca: Array<{ praca: string; mai2025: number; mai2026OTB: number; deltaPct: number }>
}

export function YoYComparison({
  baselineLabel,
  currentLabel,
  totalBaseline,
  totalCurrent,
  deltaPct,
  porPraca,
}: YoYProps) {
  const sorted = [...porPraca].sort((a, b) => b.mai2026OTB - a.mai2026OTB)
  const delta = totalCurrent - totalBaseline
  const positive = delta >= 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-violet-600" />
            <CardTitle className="text-base">Comparativo Ano vs Ano</CardTitle>
          </div>
          <Badge
            variant="outline"
            className={
              positive
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-red-50 text-red-700 border-red-200"
            }
          >
            {positive ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
            {positive ? "+" : ""}
            {deltaPct.toFixed(1)}%
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {currentLabel} (OTB) vs {baselineLabel} (realizado).
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border bg-muted/30 p-2">
            <p className="text-[10px] text-muted-foreground uppercase">{baselineLabel}</p>
            <p className="text-sm font-bold">{formatCurrency(totalBaseline)}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2">
            <p className="text-[10px] text-muted-foreground uppercase">{currentLabel} OTB</p>
            <p className="text-sm font-bold text-blue-700">{formatCurrency(totalCurrent)}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2">
            <p className="text-[10px] text-muted-foreground uppercase">Delta</p>
            <p className={`text-sm font-bold ${positive ? "text-emerald-700" : "text-red-700"}`}>
              {positive ? "+" : ""}
              {formatCurrency(delta)}
            </p>
          </div>
        </div>

        <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
          {sorted.map((row) => {
            const pos = row.deltaPct >= 0
            const max = Math.max(row.mai2025, row.mai2026OTB, 1)
            const pctBaseline = (row.mai2025 / max) * 100
            const pctCurrent = (row.mai2026OTB / max) * 100
            return (
              <div key={row.praca} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
                <div className="w-24 shrink-0">
                  <p className="text-xs font-medium truncate" title={row.praca}>
                    {row.praca}
                  </p>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 rounded-full bg-slate-300" style={{ width: `${pctBaseline}%` }} />
                    <span className="text-[10px] tabular-nums text-muted-foreground w-20 text-right">
                      {formatCurrency(row.mai2025)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${pctCurrent}%` }} />
                    <span className="text-[10px] tabular-nums text-blue-700 w-20 text-right font-semibold">
                      {formatCurrency(row.mai2026OTB)}
                    </span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${
                    pos
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  {pos ? "+" : ""}
                  {row.deltaPct.toFixed(0)}%
                </Badge>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
