"use client"

import { useDashboardData } from "@/contexts/dashboard-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  BarChart, Bar, XAxis, YAxis, LineChart, Line,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from "recharts"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import {
  addDays, format, isSameDay, parseISO, startOfDay,
  isWithinInterval, subDays, isValid, nextDay, getDay,
  startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  addMonths, subMonths, startOfWeek, endOfWeek,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { useState, useMemo } from "react"

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const COLORS_PRACA = ["#1e40af", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#7dd3fc", "#38bdf8", "#0ea5e9"]

export default function AvailabilityPage() {
  const { data: properties, loading } = useDashboardData()
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dialogType, setDialogType] = useState<"weekend" | "gaps" | "expired" | null>(null)
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))

  const today = useMemo(() => startOfDay(new Date()), [])

  const next15Days = useMemo(() =>
    Array.from({ length: 15 }, (_, i) => addDays(today, i))
    , [today])

  // ── Occupancy helpers ──

  function isOccupied(property: any, date: Date, dateStr: string) {
    const occ = property.ocupacao?.find((o: any) => o.datas === dateStr)
    if (occ) return occ.ocupado === 1
    return property.reservas.some((r: any) => {
      if (!r.checkindate || !r.checkoutdate) return false
      return isWithinInterval(date, { start: parseISO(r.checkindate), end: subDays(parseISO(r.checkoutdate), 1) })
    })
  }

  function getStatus(property: any, date: Date, dateStr: string) {
    const occ = property.ocupacao?.find((o: any) => o.datas === dateStr)
    if (occ) {
      if (occ.ocupado === 1) return "occupied"
      if (occ.manutencao === 1 || occ.ocupado_proprietario === 1) return "blocked"
      return "available"
    }
    return isOccupied(property, date, dateStr) ? "occupied" : "available"
  }

  // ── Calendar data ──

  const calendarWeeks = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: calStart, end: calEnd })
    const weeks: Date[][] = []
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
    return weeks
  }, [currentMonth])

  const occupancyMap = useMemo(() => {
    const map: Record<string, { pct: number; occ: number; blk: number; avail: number }> = {}
    if (properties.length === 0) return map
    const allCalDays = calendarWeeks.flat()
    allCalDays.forEach(date => {
      const ds = format(date, "yyyy-MM-dd")
      let occ = 0, blk = 0, avail = 0
      properties.forEach(p => {
        const s = getStatus(p, date, ds)
        if (s === "occupied") occ++
        else if (s === "blocked") blk++
        else avail++
      })
      const total = properties.length
      map[ds] = { pct: total > 0 ? Math.round((occ / total) * 100) : 0, occ, blk, avail }
    })
    return map
  }, [properties, calendarWeeks])

  // ── Enriched properties (gap/weekend) ──

  const enrichedProperties = useMemo(() => properties.map(property => {
    const avMap = next15Days.map(date => {
      const ds = format(date, "yyyy-MM-dd")
      const reservation = property.reservas.find((r: any) => {
        if (!r.checkindate || !r.checkoutdate) return false
        return isWithinInterval(date, { start: parseISO(r.checkindate), end: subDays(parseISO(r.checkoutdate), 1) })
      })
      const occ = property.ocupacao?.find((o: any) => o.datas === ds)
      const blocked = occ ? (occ.manutencao === 1 || occ.ocupado_proprietario === 1) : false
      let status: "free" | "occupied" | "blocked" | "gap" = "free"
      if (reservation) status = "occupied"
      if (blocked) status = "blocked"
      return { date, status: status as "free" | "occupied" | "blocked" | "gap", price: property.metricas?.precoMedioNoite || 0, reservation, gapLength: 0, gapStart: null as Date | null, gapEnd: null as Date | null }
    })

    // Find consecutive free runs of >= 3 days between reservations → mark middle day as gap
    const withGaps = [...avMap]
    let i = 0
    while (i < withGaps.length) {
      if (withGaps[i].status === "free") {
        let j = i
        while (j < withGaps.length && withGaps[j].status === "free") j++
        const runLength = j - i
        if (runLength >= 3 && runLength <= 5) {
          // Must be bounded by a booking on both sides
          const hasPrevBooking = i > 0
            || isOccupied(property, subDays(next15Days[0], 1), format(subDays(next15Days[0], 1), "yyyy-MM-dd"))
          const hasNextBooking = j < withGaps.length
          if (hasPrevBooking && hasNextBooking) {
            const midIdx = i + Math.floor(runLength / 2)
            withGaps[midIdx] = {
              ...withGaps[midIdx],
              status: "gap" as const,
              gapLength: runLength,
              gapStart: withGaps[i].date,
              gapEnd: withGaps[j - 1].date,
            }
          }
        }
        i = j
      } else {
        i++
      }
    }

    return { ...property, availability: withGaps }
  }), [properties, next15Days])

  // ── KPIs ──

  const { weekendOccupancy, expiredCount, gapCount, weekendFreeCount } = useMemo(() => {
    const total = properties.length
    let gaps = 0

    enrichedProperties.forEach(p => {
      gaps += p.availability.filter((d: any) => d.status === "gap").length
    })

    // Next weekend occupancy %
    const nFri = nextDay(today, 5), nSat = addDays(nFri, 1), nSun = addDays(nFri, 2)
    const friStr = format(nFri, "yyyy-MM-dd"), satStr = format(nSat, "yyyy-MM-dd"), sunStr = format(nSun, "yyyy-MM-dd")
    const wkendDates = [nFri, nSat, nSun]
    const wkendStrs = [friStr, satStr, sunStr]
    let wkOcc = 0, wkTotal = total * 3
    wkendDates.forEach((d, idx) => {
      properties.forEach(p => { if (isOccupied(p, d, wkendStrs[idx])) wkOcc++ })
    })
    const weekendOcc = wkTotal > 0 ? Math.round((wkOcc / wkTotal) * 100) : 0

    // Weekend free count (Sex + Sab)
    const wkFree = enrichedProperties.filter(p => {
      const f = p.availability.find((d: any) => format(d.date, "yyyy-MM-dd") === friStr)
      const s = p.availability.find((d: any) => format(d.date, "yyyy-MM-dd") === satStr)
      return f?.status === "free" && s?.status === "free"
    }).length

    // Expired units: properties that were free last weekend (past Fri+Sat)
    const lastFri = subDays(nFri, 7), lastSat = subDays(nSat, 7)
    const lastFriStr = format(lastFri, "yyyy-MM-dd"), lastSatStr = format(lastSat, "yyyy-MM-dd")
    let expired = 0
    properties.forEach(p => {
      const friFree = !isOccupied(p, lastFri, lastFriStr)
      const satFree = !isOccupied(p, lastSat, lastSatStr)
      if (friFree && satFree) expired++
    })

    return {
      weekendOccupancy: weekendOcc,
      expiredCount: expired,
      gapCount: gaps,
      weekendFreeCount: wkFree,
    }
  }, [properties, enrichedProperties, today])

  // ── Weekend & gaps lists ──

  const { weekendFreeList, gapsList, expiredList, nextFri, nextSat, lastFri, lastSat } = useMemo(() => {
    const nFri = nextDay(today, 5), nSat = addDays(nFri, 1)
    const friStr = format(nFri, "yyyy-MM-dd"), satStr = format(nSat, "yyyy-MM-dd")

    const wkList = enrichedProperties.filter(p => {
      const f = p.availability.find((d: any) => format(d.date, "yyyy-MM-dd") === friStr)
      const s = p.availability.find((d: any) => format(d.date, "yyyy-MM-dd") === satStr)
      return f?.status === "free" && s?.status === "free"
    })
    const gList = enrichedProperties.flatMap(p =>
      p.availability.filter((d: any) => d.status === "gap").map((d: any) => ({
        property: p, date: d.date, price: d.price,
        gapLength: d.gapLength, gapStart: d.gapStart, gapEnd: d.gapEnd,
      }))
    )

    // Expired: units free last weekend
    const lFri = subDays(nFri, 7), lSat = subDays(nSat, 7)
    const lFriStr = format(lFri, "yyyy-MM-dd"), lSatStr = format(lSat, "yyyy-MM-dd")
    const eList = properties.filter(p => {
      const friFree = !isOccupied(p, lFri, lFriStr)
      const satFree = !isOccupied(p, lSat, lSatStr)
      return friFree && satFree
    })

    return { weekendFreeList: wkList, gapsList: gList, expiredList: eList, nextFri: nFri, nextSat: nSat, lastFri: lFri, lastSat: lSat }
  }, [enrichedProperties, properties, today])

  // ── Daily occupancy (last 14 + next 14 days) ──

  const dailyOccupancyData = useMemo(() => {
    if (properties.length === 0) return []
    const total = properties.length
    return Array.from({ length: 29 }, (_, i) => {
      const date = addDays(today, i - 14)
      const ds = format(date, "yyyy-MM-dd")
      let occ = 0
      properties.forEach(p => { if (isOccupied(p, date, ds)) occ++ })
      return {
        dia: format(date, "dd/MM"),
        dow: format(date, "EEE", { locale: ptBR }),
        ocupacao: total > 0 ? Math.round((occ / total) * 100) : 0,
        isToday: isSameDay(date, today),
      }
    })
  }, [properties, today])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-6 max-w-[1400px]">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Disponibilidade</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{properties.length} unidades</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Ocupação FDS" value={`${weekendOccupancy}%`} sub={`Sex–Dom ${format(nextFri, "dd/MM")}`} />
        <KpiCard
          label="Unidades vencidas"
          value={String(expiredCount)}
          sub={`Vazias no FDS ${format(lastFri, "dd/MM")}`}
          accent="red"
          onClick={() => setDialogType("expired")}
        />
        <KpiCard
          label="Gaps"
          value={String(gapCount)}
          sub="Intervalos de 3–5 dias livres"
          accent="orange"
          onClick={() => setDialogType("gaps")}
        />
        <KpiCard
          label="FDS livre"
          value={String(weekendFreeCount)}
          sub={`${format(nextFri, "dd/MM")} – ${format(nextSat, "dd/MM")}`}
          accent="emerald"
          onClick={() => setDialogType("weekend")}
        />
      </div>

      {/* Daily occupancy chart */}
      {dailyOccupancyData.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ocupação diária</CardTitle>
            <p className="text-[11px] text-muted-foreground">Últimos 14 dias + próximos 14 dias</p>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyOccupancyData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                  <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#334155" }} interval={1} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 13 }}
                    formatter={((v: number | undefined) => [`${v ?? 0}%`, "Ocupação"]) as any}
                    labelFormatter={((label: any, payload: any[]) => {
                      const entry = payload?.[0]?.payload
                      return entry ? `${label} (${entry.dow})` : label
                    }) as any}
                  />
                  <Line
                    type="monotone"
                    dataKey="ocupacao"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props
                      return (
                        <circle
                          key={props.key}
                          cx={cx} cy={cy}
                          r={payload.isToday ? 6 : 3}
                          fill={payload.isToday ? "#1e40af" : "#2563eb"}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      )
                    }}
                    activeDot={{ r: 6, fill: "#1e40af", strokeWidth: 2, stroke: "#fff" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentMonth(m => subMonths(m, 1))}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            </button>
            <CardTitle className="text-base font-semibold capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </CardTitle>
            <button
              onClick={() => setCurrentMonth(m => addMonths(m, 1))}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => (
              <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="space-y-1.5">
            {calendarWeeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1.5">
                {week.map(date => {
                  const ds = format(date, "yyyy-MM-dd")
                  const data = occupancyMap[ds]
                  const inMonth = isSameMonth(date, currentMonth)
                  const isToday = isSameDay(date, today)
                  const pct = data?.pct ?? 0
                  return (
                    <button
                      key={ds}
                      onClick={() => setSelectedDate(date)}
                      className={`relative flex flex-col items-center justify-center rounded-lg py-2 px-1 transition-all
                        ${inMonth ? "hover:ring-2 hover:ring-primary/30" : "opacity-25 pointer-events-none"}
                        ${isToday ? "ring-2 ring-primary" : ""}
                        ${inMonth ? occBg(pct) : ""}
                      `}
                    >
                      <span className={`text-xs font-medium ${isToday ? "text-primary" : inMonth ? "text-foreground" : "text-muted-foreground"}`}>
                        {format(date, "d")}
                      </span>
                      {inMonth && data && (
                        <span className={`text-[10px] font-semibold leading-tight ${occText(pct)}`}>
                          {pct}%
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100" /> &ge;70%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100" /> 40–69%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100" /> &lt;40%</span>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <Dialog open={!!dialogType} onOpenChange={open => !open && setDialogType(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col gap-0">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-lg">
              {dialogType === "weekend" && "Fim de semana livre"}
              {dialogType === "gaps" && "Gaps identificados"}
              {dialogType === "expired" && "Unidades vencidas"}
            </DialogTitle>
          </DialogHeader>
          {dialogType === "weekend" && <WeekendList list={weekendFreeList} dates={[nextFri, nextSat]} totalProperties={properties.length} />}
          {dialogType === "gaps" && <GapsList list={gapsList} />}
          {dialogType === "expired" && <ExpiredList list={expiredList} dates={[lastFri, lastSat]} allProperties={properties} />}
        </DialogContent>
      </Dialog>

      {/* Day Details Dialog */}
      <Dialog open={!!selectedDate} onOpenChange={open => { if (!open) setSelectedDate(null) }}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg">
              {selectedDate && `${format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} — ${format(selectedDate, "EEEE", { locale: ptBR })}`}
            </DialogTitle>
            {selectedDate && occupancyMap[format(selectedDate, "yyyy-MM-dd")] && (
              <div className="flex gap-3 text-xs text-muted-foreground pt-1">
                <span>{occupancyMap[format(selectedDate, "yyyy-MM-dd")].occ} ocupadas</span>
                <span>{occupancyMap[format(selectedDate, "yyyy-MM-dd")].blk} bloqueadas</span>
                <span>{occupancyMap[format(selectedDate, "yyyy-MM-dd")].avail} disponíveis</span>
              </div>
            )}
          </DialogHeader>
          {selectedDate && <DayDetailsSection properties={properties} date={selectedDate} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function occBg(pct: number) {
  if (pct >= 70) return "bg-emerald-50"
  if (pct >= 40) return "bg-amber-50"
  return "bg-red-50"
}

function occText(pct: number) {
  if (pct >= 70) return "text-emerald-700"
  if (pct >= 40) return "text-amber-700"
  return "text-red-700"
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent, onClick }: {
  label: string; value: string; sub: string; accent?: "orange" | "emerald" | "red"; onClick?: () => void
}) {
  const valueColor = accent === "orange" ? "text-orange-600" : accent === "emerald" ? "text-emerald-600" : accent === "red" ? "text-red-600" : ""
  return (
    <Card
      className={`border-0 shadow-sm ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      onClick={onClick}
    >
      <CardContent className="pt-5 pb-4 px-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-semibold mt-1 ${valueColor}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  )
}

// ─── Day Details ────────────────────────────────────────────────────────────

function DayDetailsSection({ properties, date }: { properties: any[]; date: Date }) {
  const dateStr = format(date, "yyyy-MM-dd")

  const items = useMemo(() => properties.map((property: any) => {
    const occ = property.ocupacao?.find((o: any) => o.datas === dateStr)
    let status = "available", detail = null as any
    if (occ) {
      if (occ.ocupado === 1) status = "occupied"
      else if (occ.manutencao === 1 || occ.ocupado_proprietario === 1) status = "blocked"
    } else {
      property.reservas?.some((r: any) => {
        if (!r.checkindate || !r.checkoutdate) return false
        const isRez = isWithinInterval(date, { start: parseISO(r.checkindate), end: subDays(parseISO(r.checkoutdate), 1) })
        if (isRez) { detail = r; status = "occupied" }
        return isRez
      })
    }
    return { ...property, status, detail }
  }), [properties, dateStr, date])

  const available = useMemo(() => items.filter((i: any) => i.status === "available").sort((a: any, b: any) => (b.metricas?.precoMedioNoite || 0) - (a.metricas?.precoMedioNoite || 0)), [items])
  const occupied = useMemo(() => items.filter((i: any) => i.status === "occupied"), [items])
  const blocked = useMemo(() => items.filter((i: any) => i.status === "blocked"), [items])

  // Occupancy % by praça for chart
  const pracaChartData = useMemo(() => {
    const counts: Record<string, { occ: number; total: number }> = {}
    items.forEach((item: any) => {
      const praca = item.propriedade?.praca || "Outros"
      if (!counts[praca]) counts[praca] = { occ: 0, total: 0 }
      counts[praca].total++
      if (item.status === "occupied") counts[praca].occ++
    })
    return Object.entries(counts)
      .map(([praca, { occ, total }]) => ({
        praca,
        ocupacao: total > 0 ? Math.round((occ / total) * 100) : 0,
        total,
      }))
      .sort((a, b) => b.ocupacao - a.ocupacao)
  }, [items])

  return (
    <div className="pt-2">
      {/* Occupancy by praça chart */}
      {pracaChartData.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Ocupação por praça</p>
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pracaChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="praca" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#334155" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 13 }}
                  formatter={((v: number | undefined, _: string, entry: any) => [`${v ?? 0}% (${entry.payload.total} un.)`]) as any}
                  labelFormatter={((label: any) => String(label)) as any}
                />
                <Bar dataKey="ocupacao" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {pracaChartData.map((_, i) => (
                    <Cell key={i} fill={COLORS_PRACA[i % COLORS_PRACA.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <Tabs defaultValue="available">
        <TabsList className="mb-4 bg-muted/50">
          <TabsTrigger value="available">Disponíveis ({available.length})</TabsTrigger>
          <TabsTrigger value="occupied">Ocupadas ({occupied.length})</TabsTrigger>
          <TabsTrigger value="blocked">Bloqueadas ({blocked.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="mt-0">
          <PropertyGrid items={available} renderBadge={(item: any) => (
            <span className="text-sm font-semibold text-emerald-600">
              R$ {item.metricas?.precoMedioNoite ? Number(item.metricas.precoMedioNoite).toFixed(0) : "-"}
            </span>
          )} />
          {available.length === 0 && <Empty text="Nenhuma unidade disponível." />}
        </TabsContent>

        <TabsContent value="occupied" className="mt-0">
          <PropertyGrid items={occupied} renderBadge={(item: any) => (
            <Badge variant="secondary" className="text-xs font-normal">
              {item.detail ? truncate(item.detail.partnername, 15) : "Ocupado"}
            </Badge>
          )} />
          {occupied.length === 0 && <Empty text="Nenhuma ocupação." />}
        </TabsContent>

        <TabsContent value="blocked" className="mt-0">
          <PropertyGrid items={blocked} renderBadge={() => (
            <Badge variant="outline" className="text-xs">Bloqueio</Badge>
          )} />
          {blocked.length === 0 && <Empty text="Nenhum bloqueio." />}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PropertyGrid({ items, renderBadge }: { items: any[]; renderBadge: (item: any) => React.ReactNode }) {
  const grouped = useMemo(() => groupByLocation(items), [items])

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([praca, grupos]) => (
        <div key={praca}>
          <h3 className="text-sm font-semibold text-foreground mb-2">{praca}</h3>
          {Object.entries(grupos).map(([grupo, unidades]: [string, any[]]) => (
            <div key={grupo} className="mb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 ml-0.5">{grupo}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {unidades.map((item: any) => {
                  const prop = item.propriedade || item.property?.propriedade
                  return (
                    <div key={prop?.idpropriedade} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 hover:bg-muted/30 transition-colors">
                      <div className="min-w-0 flex-1">
                        <PropertyLink id={prop?.idpropriedade} name={prop?.nomepropriedade} />
                        <p className="text-[11px] text-muted-foreground">{prop?.empreendimento_pousada}</p>
                      </div>
                      <span className="shrink-0">{renderBadge(item)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Weekend Modal (with mini chart) ────────────────────────────────────────

function WeekendList({ list, dates, totalProperties }: { list: any[]; dates: Date[]; totalProperties: number }) {
  const grouped = useMemo(() => groupByLocation(list), [list])

  // Mini chart data: praça x disponibilidade
  const pracaChartData = useMemo(() => {
    const counts: Record<string, { free: number; total: number }> = {}

    // Count total properties per praça
    list.forEach(p => {
      const praca = p.propriedade?.praca || "Outros"
      if (!counts[praca]) counts[praca] = { free: 0, total: 0 }
      counts[praca].free++
    })

    return Object.entries(counts)
      .map(([praca, { free }]) => ({ praca, unidades: free }))
      .sort((a, b) => b.unidades - a.unidades)
  }, [list])

  return (
    <div className="flex-1 overflow-y-auto space-y-4 pt-2">
      {/* Mini chart - vertical bars */}
      {pracaChartData.length > 0 && (
        <div className="px-1">
          <p className="text-xs text-muted-foreground mb-2">Unidades livres por praça</p>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pracaChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="praca" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#334155" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 13 }}
                  formatter={((v: number | undefined) => [`${v ?? 0} unidades`]) as any}
                />
                <Bar dataKey="unidades" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {pracaChartData.map((_, i) => (
                    <Cell key={i} fill={COLORS_PRACA[i % COLORS_PRACA.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
        <strong>{list.length}</strong> unidades com Sex ({format(dates[0], "dd/MM")}) e Sáb ({format(dates[1], "dd/MM")}) livres
      </div>

      {Object.entries(grouped).map(([praca, grupos]) => (
        <div key={praca}>
          <h3 className="text-sm font-semibold mb-1.5">{praca}</h3>
          {Object.entries(grupos).map(([grupo, unidades]: [string, any[]]) => (
            <div key={grupo} className="mb-2 ml-2">
              <p className="text-xs text-muted-foreground mb-1">{grupo}</p>
              <div className="space-y-1">
                {unidades.map((p: any) => {
                  const targetDateStr = format(dates[0], "yyyy-MM-dd");
                  const activeTariffRow = p.tarifario?.find((t: any) => targetDateStr >= t.from && targetDateStr <= t.to);
                  const rawBasePrice = activeTariffRow ? activeTariffRow.baserate : (p.metricas?.precoMedioNoite || p.baserate_atual || 0);
                  const discountObj = p.discounts?.find((d: any) => d.date === targetDateStr);

                  return (
                    <div key={p.propriedade.idpropriedade} className="flex flex-col gap-2 rounded-md border px-3 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <PropertyLink id={p.propriedade.idpropriedade} name={p.propriedade.nomepropriedade} />
                        <Badge variant="outline" className="text-emerald-600 border-emerald-200 text-xs shrink-0">Livre</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground bg-emerald-50/50 px-2.5 py-2 rounded-md border border-emerald-100/50">
                        <div className="flex items-center gap-1.5 min-w-max">
                          <CalendarIcon className="w-3 h-3 shrink-0 text-emerald-600/70" />
                          <span className="font-medium text-emerald-800/80">
                            {format(dates[0], "dd/MM")} – {format(dates[1], "dd/MM")}
                          </span>
                        </div>
                        <div className="h-3 w-px bg-emerald-200 hidden sm:block" />
                        <div className="flex items-center gap-1 min-w-max">
                          Tarifário: <span className="font-semibold text-foreground">R$ {Number(rawBasePrice).toFixed(0)}</span>
                          {discountObj && discountObj.discount_percent > 0 ? (
                            <span className={discountObj.is_rise ? "ml-1 text-emerald-600 font-medium" : "ml-1 text-destructive font-medium"}>
                              ({discountObj.is_rise ? '+' : '-'}{discountObj.discount_percent}%)
                            </span>
                          ) : (
                            <span className="ml-1 opacity-60">(Sem ajuste)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
      {list.length === 0 && <Empty text="Nenhuma oportunidade para este fim de semana." />}
    </div>
  )
}

// ─── Gaps Modal ─────────────────────────────────────────────────────────────

function GapsList({ list }: { list: any[] }) {
  const [filterDow, setFilterDow] = useState<string | null>(null)

  const sorted = useMemo(() => [...list].sort((a: any, b: any) => a.date.getTime() - b.date.getTime()), [list])

  // Day-of-week breakdown
  const dowData = useMemo(() => {
    const counts: Record<number, number> = {}
    for (let d = 0; d < 7; d++) counts[d] = 0
    sorted.forEach(item => { counts[getDay(item.date)]++ })
    const total = sorted.length || 1
    return [1, 2, 3, 4, 5, 6, 0].map(dow => ({
      day: DAY_LABELS[dow],
      dow,
      gaps: counts[dow],
      pct: Math.round((counts[dow] / total) * 100),
    }))
  }, [sorted])

  const filtered = useMemo(() => {
    if (!filterDow) return sorted
    return sorted.filter(item => DAY_LABELS[getDay(item.date)] === filterDow)
  }, [sorted, filterDow])

  const grouped = useMemo(() => groupByLocation(filtered), [filtered])

  const handleBarClick = (data: any) => {
    const day = data?.activePayload?.[0]?.payload?.day
    if (day) setFilterDow(prev => prev === day ? null : day)
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-4 pt-2">
      {/* Day of week concentration */}
      {sorted.length > 0 && (
        <div className="px-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">Concentração de gaps por dia da semana</p>
            {filterDow && (
              <button
                onClick={() => setFilterDow(null)}
                className="text-[11px] text-orange-600 hover:text-orange-700 font-medium transition-colors"
              >
                Limpar filtro
              </button>
            )}
          </div>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dowData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} onClick={handleBarClick} style={{ cursor: "pointer" }}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => `${v}%`} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 13 }}
                  formatter={((v: number | undefined, name: string) => [name === "pct" ? `${v ?? 0}%` : `${v ?? 0} gaps`]) as any}
                />
                <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={32} name="pct" cursor="pointer">
                  {dowData.map((entry, i) => (
                    <Cell key={i} fill={filterDow && entry.day !== filterDow ? "#bfdbfe" : "#2563eb"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
        {filterDow
          ? <><strong>{filtered.length}</strong> gaps em <strong>{filterDow}</strong> (de {sorted.length} total)</>
          : <><strong>{sorted.length}</strong> {sorted.length === 1 ? "gap" : "gaps"}: intervalos de 3–5 dias livres entre reservas (próx. 15 dias).</>
        }
      </div>
      {Object.entries(grouped).map(([praca, grupos]) => (
        <div key={praca}>
          <h3 className="text-sm font-semibold mb-1.5">{praca}</h3>
          {Object.entries(grupos).map(([grupo, items]: [string, any[]]) => (
            <div key={grupo} className="mb-2 ml-2">
              <p className="text-xs text-muted-foreground mb-1">{grupo}</p>
              <div className="space-y-1">
                {items.map((item: any, i: number) => {
                  const targetDateStr = format(item.gapStart || item.date, "yyyy-MM-dd");
                  const p = item.property;
                  const activeTariffRow = p.tarifario?.find((t: any) => targetDateStr >= t.from && targetDateStr <= t.to);
                  const rawBasePrice = activeTariffRow ? activeTariffRow.baserate : (p.metricas?.precoMedioNoite || p.baserate_atual || 0);
                  const discountObj = p.discounts?.find((d: any) => d.date === targetDateStr);

                  return (
                    <div key={i} className="flex flex-col gap-2 rounded-md border px-3 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <PropertyLink id={item.property.propriedade.idpropriedade} name={item.property.propriedade.nomepropriedade} />
                        <Badge variant="outline" className="text-orange-600 border-orange-200 text-xs shrink-0">{item.gapLength} dias</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground bg-orange-50/50 px-2.5 py-2 rounded-md border border-orange-100/50">
                        <div className="flex items-center gap-1.5 min-w-max">
                          <CalendarIcon className="w-3 h-3 shrink-0 text-orange-600/70" />
                          <span className="font-medium text-orange-800/80">
                            {item.gapStart && item.gapEnd
                              ? `${format(item.gapStart, "dd/MM")} – ${format(item.gapEnd, "dd/MM")}`
                              : `${format(item.date, "dd/MM")} (${format(item.date, "EEE", { locale: ptBR })})`
                            }
                          </span>
                        </div>
                        <div className="h-3 w-px bg-orange-200 hidden sm:block" />
                        <div className="flex items-center gap-1 min-w-max">
                          Tarifário: <span className="font-semibold text-foreground">R$ {Number(rawBasePrice).toFixed(0)}</span>
                          {discountObj && discountObj.discount_percent > 0 ? (
                            <span className={discountObj.is_rise ? "ml-1 text-emerald-600 font-medium" : "ml-1 text-destructive font-medium"}>
                              ({discountObj.is_rise ? '+' : '-'}{discountObj.discount_percent}%)
                            </span>
                          ) : (
                            <span className="ml-1 opacity-60">(Sem ajuste)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
      {sorted.length === 0 && <Empty text="Nenhum gap identificado." />}
    </div>
  )
}

// ─── Expired List ───────────────────────────────────────────────────────────

function ExpiredList({ list, dates, allProperties }: { list: any[]; dates: Date[]; allProperties: any[] }) {
  const grouped = useMemo(() => groupByLocation(list), [list])

  // Vacancy % by praça
  const pracaChartData = useMemo(() => {
    const totals: Record<string, number> = {}
    const expired: Record<string, number> = {}
    allProperties.forEach((p: any) => {
      const praca = p.propriedade?.praca || "Outros"
      totals[praca] = (totals[praca] || 0) + 1
    })
    list.forEach((p: any) => {
      const praca = p.propriedade?.praca || "Outros"
      expired[praca] = (expired[praca] || 0) + 1
    })
    return Object.entries(totals)
      .map(([praca, total]) => ({
        praca,
        vacancia: total > 0 ? Math.round(((expired[praca] || 0) / total) * 100) : 0,
        vencidas: expired[praca] || 0,
        total,
      }))
      .filter(d => d.vencidas > 0)
      .sort((a, b) => b.vacancia - a.vacancia)
  }, [list, allProperties])

  return (
    <div className="flex-1 overflow-y-auto space-y-4 pt-2">
      {/* Vacancy by praça chart */}
      {pracaChartData.length > 0 && (
        <div className="px-1">
          <p className="text-xs text-muted-foreground mb-2">Vacância por praça</p>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pracaChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="praca" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#334155" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 13 }}
                  formatter={((v: number | undefined, _: string, entry: any) => [`${v ?? 0}% (${entry.payload.vencidas}/${entry.payload.total} un.)`]) as any}
                  labelFormatter={((label: any) => String(label)) as any}
                />
                <Bar dataKey="vacancia" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {pracaChartData.map((_, i) => (
                    <Cell key={i} fill={COLORS_PRACA[i % COLORS_PRACA.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground bg-red-50 rounded-md px-3 py-2 border border-red-100">
        <strong>{list.length}</strong> unidades ficaram vazias no FDS de {format(dates[0], "dd/MM")} – {format(dates[1], "dd/MM")}
      </div>
      {Object.entries(grouped).map(([praca, grupos]) => (
        <div key={praca}>
          <h3 className="text-sm font-semibold mb-1.5">{praca}</h3>
          {Object.entries(grupos).map(([grupo, unidades]: [string, any[]]) => (
            <div key={grupo} className="mb-2 ml-2">
              <p className="text-xs text-muted-foreground mb-1">{grupo}</p>
              <div className="space-y-1">
                {unidades.map((p: any) => {
                  // Retroactively count consecutive empty weekends
                  let emptyWeekends = 0;
                  let cFri = dates[0];
                  let cSat = dates[1];
                  while (emptyWeekends < 52) { // 1 year cap
                    const isOccupiedFri = p.reservas?.some((r: any) => {
                      if (!r.checkindate || !r.checkoutdate) return false;
                      return isWithinInterval(cFri, { start: parseISO(r.checkindate), end: subDays(parseISO(r.checkoutdate), 1) });
                    });
                    const isOccupiedSat = p.reservas?.some((r: any) => {
                      if (!r.checkindate || !r.checkoutdate) return false;
                      return isWithinInterval(cSat, { start: parseISO(r.checkindate), end: subDays(parseISO(r.checkoutdate), 1) });
                    });
                    if (!isOccupiedFri && !isOccupiedSat) {
                      emptyWeekends++;
                      cFri = subDays(cFri, 7);
                      cSat = subDays(cSat, 7);
                    } else {
                      break;
                    }
                  }

                  // Determine applied rates and discounts for the target weekend
                  const targetDateStr = format(dates[0], "yyyy-MM-dd");
                  const activeTariffRow = p.tarifario?.find((t: any) => targetDateStr >= t.from && targetDateStr <= t.to);
                  const rawBasePrice = activeTariffRow ? activeTariffRow.baserate : (p.metricas?.precoMedioNoite || p.baserate_atual || 0);
                  const discountObj = p.discounts?.find((d: any) => d.date === targetDateStr);

                  return (
                    <div key={p.propriedade.idpropriedade} className="flex flex-col gap-2 rounded-md border px-3 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <PropertyLink id={p.propriedade.idpropriedade} name={p.propriedade.nomepropriedade} />
                        <Badge variant="outline" className="text-red-600 border-red-200 text-xs shrink-0">Vencida</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground bg-red-50/50 px-2.5 py-2 rounded-md border border-red-100/50">
                        <div className="flex items-center gap-1.5 min-w-max">
                          <span className="font-semibold text-red-700/80 text-xs">{emptyWeekends}</span> {emptyWeekends === 1 ? 'FDS Vazio' : 'FDS Vazios (Consecutivos)'}
                        </div>
                        <div className="h-3 w-px bg-red-200 hidden sm:block" />
                        <div className="flex items-center gap-1 min-w-max">
                          Tarifário: <span className="font-semibold text-foreground">R$ {Number(rawBasePrice).toFixed(0)}</span>
                          {discountObj && discountObj.discount_percent > 0 ? (
                            <span className={discountObj.is_rise ? "ml-1 text-emerald-600 font-medium" : "ml-1 text-destructive font-medium"}>
                              ({discountObj.is_rise ? '+' : '-'}{discountObj.discount_percent}%)
                            </span>
                          ) : (
                            <span className="ml-1 opacity-60">(Sem ajuste)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
      {list.length === 0 && <Empty text="Nenhuma unidade vencida no último fim de semana." />}
    </div>
  )
}

// ─── Shared ─────────────────────────────────────────────────────────────────

function PropertyLink({ id, name }: { id: string; name: string }) {
  return (
    <a href={`https://beto.stays.com.br/i/apartment/${id}`} target="_blank" rel="noopener noreferrer"
      className="text-sm text-foreground hover:underline flex items-center gap-1 group break-words">
      {name}
      <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
    </a>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-center py-10 text-sm text-muted-foreground">{text}</p>
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "..." : s
}

function groupByLocation(items: any[]) {
  const g: Record<string, Record<string, any[]>> = {}
  items.forEach(item => {
    const p = item.propriedade || item.property?.propriedade
    if (!p) return
    const praca = p.praca || "Outros", grupo = p.grupo_nome || "Sem Grupo"
    if (!g[praca]) g[praca] = {}
    if (!g[praca][grupo]) g[praca][grupo] = []
    g[praca][grupo].push(item)
  })
  return g
}
