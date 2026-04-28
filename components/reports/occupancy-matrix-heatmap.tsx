"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "lucide-react"
import type { OccupancyRow } from "@/types"
import { getMonthName, formatDateBR } from "@/lib/calculations"

interface OccupancyMatrixHeatmapProps {
  rows: OccupancyRow[]
  mes: string
  daysInMonth: number
}

interface DayAggregate {
  date: string
  ocupado: number
  disponivel: number
  manutencao: number
  block: number
  total: number
  pct: number
}

function bgClassFor(pct: number): string {
  if (pct >= 70) return "bg-emerald-100 text-emerald-800"
  if (pct >= 40) return "bg-amber-100 text-amber-800"
  return "bg-red-100 text-red-800"
}

export function OccupancyMatrixHeatmap({ rows, mes, daysInMonth }: OccupancyMatrixHeatmapProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const dailyAgg: DayAggregate[] = useMemo(() => {
    const totals = new Map<string, { ocupado: number; disponivel: number; manutencao: number; block: number }>()
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${mes}-${String(d).padStart(2, "0")}`
      totals.set(date, { ocupado: 0, disponivel: 0, manutencao: 0, block: 0 })
    }
    for (const row of rows) {
      for (const day of row.dias) {
        const t = totals.get(day.date)
        if (!t) continue
        t[day.status] += 1
      }
    }
    return Array.from(totals.entries()).map(([date, t]) => {
      const total = t.ocupado + t.disponivel + t.manutencao + t.block
      return {
        date,
        ocupado: t.ocupado,
        disponivel: t.disponivel,
        manutencao: t.manutencao,
        block: t.block,
        total,
        pct: total > 0 ? (t.ocupado / total) * 100 : 0,
      }
    })
  }, [rows, mes, daysInMonth])

  const propertiesForSelectedDay = useMemo(() => {
    if (!selectedDay) return []
    return rows
      .map((row) => {
        const day = row.dias.find((d) => d.date === selectedDay)
        return { row, status: day?.status }
      })
      .filter((r) => r.status)
      .sort((a, b) => {
        const order = { ocupado: 0, manutencao: 1, block: 2, disponivel: 3 }
        return (order[a.status as keyof typeof order] ?? 99) - (order[b.status as keyof typeof order] ?? 99)
      })
  }, [selectedDay, rows])

  const [yStr, mStr] = mes.split("-")
  const monthLabel = `${getMonthName(Number.parseInt(mStr, 10))} ${yStr}`

  const firstDate = new Date(`${mes}-01T00:00:00Z`)
  const firstDow = (firstDate.getUTCDay() + 6) % 7
  const cells: Array<DayAggregate | null> = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (const day of dailyAgg) cells.push(day)

  const totalOcupacao = dailyAgg.reduce((s, d) => s + d.pct, 0) / Math.max(1, dailyAgg.length)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">Mapa de Ocupação — {monthLabel}</CardTitle>
          </div>
          <Badge variant="outline">Ocupação média prevista: {totalOcupacao.toFixed(1)}%</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
            <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((cell, idx) =>
            cell ? (
              <button
                key={cell.date}
                onClick={() => setSelectedDay(selectedDay === cell.date ? null : cell.date)}
                className={`relative flex flex-col items-center justify-center rounded-lg py-2 px-1 transition-all hover:ring-2 hover:ring-primary/30 cursor-pointer ${bgClassFor(
                  cell.pct
                )} ${selectedDay === cell.date ? "ring-2 ring-primary" : ""}`}
              >
                <span className="text-xs font-medium">
                  {Number.parseInt(cell.date.split("-")[2], 10)}
                </span>
                <span className="text-[10px] font-semibold leading-tight">{cell.pct.toFixed(0)}%</span>
              </button>
            ) : (
              <div key={`empty-${idx}`} className="opacity-25 pointer-events-none" />
            )
          )}
        </div>

        <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-100" /> ≥70%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-100" /> 40–69%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-100" /> &lt;40%
          </span>
        </div>

        {selectedDay && (
          <div className="mt-4 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">{formatDateBR(selectedDay)}</p>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="text-xs text-muted-foreground hover:text-primary"
              >
                Fechar
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
              <div className="rounded bg-emerald-50 px-2 py-1.5">
                <p className="text-emerald-700 font-semibold">Ocupados</p>
                <p className="text-lg font-bold">{dailyAgg.find((d) => d.date === selectedDay)?.ocupado || 0}</p>
              </div>
              <div className="rounded bg-red-50 px-2 py-1.5">
                <p className="text-red-700 font-semibold">Disponíveis</p>
                <p className="text-lg font-bold">{dailyAgg.find((d) => d.date === selectedDay)?.disponivel || 0}</p>
              </div>
              <div className="rounded bg-amber-50 px-2 py-1.5">
                <p className="text-amber-700 font-semibold">Manutenção</p>
                <p className="text-lg font-bold">{dailyAgg.find((d) => d.date === selectedDay)?.manutencao || 0}</p>
              </div>
              <div className="rounded bg-slate-50 px-2 py-1.5">
                <p className="text-slate-700 font-semibold">Bloqueio</p>
                <p className="text-lg font-bold">{dailyAgg.find((d) => d.date === selectedDay)?.block || 0}</p>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {propertiesForSelectedDay.slice(0, 30).map(({ row, status }) => (
                <div
                  key={row.propertyId}
                  className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-card"
                >
                  <span className="truncate">{row.nome}</span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] ${
                      status === "ocupado"
                        ? "bg-emerald-50 text-emerald-700"
                        : status === "manutencao"
                        ? "bg-amber-50 text-amber-700"
                        : status === "block"
                        ? "bg-slate-50 text-slate-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {status}
                  </Badge>
                </div>
              ))}
              {propertiesForSelectedDay.length > 30 && (
                <p className="text-[11px] text-muted-foreground text-center pt-1">
                  + {propertiesForSelectedDay.length - 30} unidades
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
