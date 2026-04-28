"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts"
import type { PickupPoint } from "@/types"
import { formatCurrency } from "@/lib/calculations"

interface PickupPaceChartProps {
  atual: PickupPoint[]
  baseline: PickupPoint[]
  baselineYear: number
  asOfDate: string
}

interface ChartRow {
  offset: number
  atual?: number
  baseline?: number
}

export function PickupPaceChart({ atual, baseline, baselineYear, asOfDate }: PickupPaceChartProps) {
  const { chartData, todayOffset, monthDays } = useMemo(() => {
    const offsetsAtual = atual.map((p) => p.offset)
    const offsetsBaseline = baseline.map((p) => p.offset)
    const minO = Math.min(-1, ...offsetsAtual, ...offsetsBaseline)
    const maxO = Math.max(31, ...offsetsAtual, ...offsetsBaseline)
    const lo = Math.max(minO, -180)
    const hi = Math.min(maxO, 60)

    const map = new Map<number, ChartRow>()
    for (let i = lo; i <= hi; i++) map.set(i, { offset: i })

    const fillCurve = (points: PickupPoint[], key: "atual" | "baseline") => {
      const byOffset = new Map<number, number>()
      for (const p of points) byOffset.set(p.offset, p.cumulativo)
      let last: number | undefined
      for (let i = lo; i <= hi; i++) {
        const v = byOffset.get(i)
        if (v !== undefined) last = v
        const row = map.get(i)!
        row[key] = last
      }
    }
    fillCurve(atual, "atual")
    fillCurve(baseline, "baseline")

    const ascending = Array.from(map.values()).sort((a, b) => a.offset - b.offset)

    const today = new Date(asOfDate + "T00:00:00Z")
    const lastAtual = atual[atual.length - 1]
    let monthStart: Date
    if (lastAtual) {
      monthStart = new Date(lastAtual.date + "T00:00:00Z")
      monthStart.setUTCDate(monthStart.getUTCDate() - lastAtual.offset)
    } else {
      monthStart = today
    }
    const offset = Math.round((today.getTime() - monthStart.getTime()) / 86_400_000)

    return { chartData: ascending, todayOffset: offset, monthDays: 31 }
  }, [atual, baseline, asOfDate])

  const finalAtual = atual.length > 0 ? atual[atual.length - 1].cumulativo : 0
  const finalBaseline = baseline.length > 0 ? baseline[baseline.length - 1].cumulativo : 0
  const deltaPct = finalBaseline > 0 ? ((finalAtual - finalBaseline) / finalBaseline) * 100 : 0
  const deltaPositive = deltaPct >= 0

  const formatOffset = (v: number): string => {
    if (v === 0) return "Início"
    if (v > 0) return `+${v}d`
    return `${v}d`
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">Pickup Pace — Curva de Vendas</CardTitle>
          </div>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <Badge variant="outline" className="gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-600" />
              Atual: {formatCurrency(finalAtual)}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-slate-400" />
              {baselineYear}: {formatCurrency(finalBaseline)}
            </Badge>
            <Badge
              variant="outline"
              className={
                deltaPositive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }
            >
              {deltaPositive ? "+" : ""}
              {deltaPct.toFixed(1)}% vs {baselineYear}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Receita acumulada por <strong>data de criação da reserva</strong>, alinhada por dias antes/depois do início do
          mês-alvo (offset 0 = primeiro dia do mês). Linha base = mesmo mês de {baselineYear}.
        </p>
      </CardHeader>
      <CardContent>
        <p className="text-[11px] text-muted-foreground text-center mb-2">
          Eixo X: dias relativos ao início do mês (0 = início, +N = dentro do mês)
        </p>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 24, right: 16, left: 0, bottom: 36 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="offset"
                type="number"
                domain={["dataMin", "dataMax"]}
                tick={{ fontSize: 11 }}
                tickFormatter={formatOffset}
                height={28}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={((value: any, name: any, item: any) => {
                  const key = item?.dataKey ?? name
                  return [
                    formatCurrency(Number(value || 0)),
                    key === "atual" ? "Atual" : `${baselineYear}`,
                  ]
                }) as any}
                labelFormatter={(v) => {
                  const n = Number(v)
                  if (n === 0) return "Início do mês"
                  if (n > 0) return `+${n} dias (dentro do mês)`
                  return `${Math.abs(n)} dias antes do mês`
                }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} verticalAlign="bottom" />
              <ReferenceLine
                x={0}
                stroke="#94a3b8"
                strokeDasharray="2 2"
                label={{ value: "Início do mês", fontSize: 10, fill: "#64748b", position: "insideTopRight", offset: 8 }}
              />
              {todayOffset >= -180 && todayOffset <= monthDays && Math.abs(todayOffset) > 5 && (
                <ReferenceLine
                  x={todayOffset}
                  stroke="#2563eb"
                  strokeDasharray="2 2"
                  label={{ value: "Hoje", fontSize: 10, fill: "#2563eb", position: "insideTopLeft", offset: 8 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="baseline"
                name={`${baselineYear}`}
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="atual"
                name="Atual"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
