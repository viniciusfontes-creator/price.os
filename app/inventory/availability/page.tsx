
"use client"

import { useDashboardData } from "@/contexts/dashboard-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarIcon, Filter, Layers, LayoutGrid, List, AlertTriangle, ArrowRight, TrendingUp, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { addDays, format, isSameDay, parseISO, startOfDay, isWithinInterval, subDays, isValid, nextDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function AvailabilityPage() {
  const { data: properties, loading } = useDashboardData()
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dialogType, setDialogType] = useState<'chart' | 'weekend' | 'gaps' | null>(null)
  // Chart View: Last 14 days + Next 14 days
  const { rangeDays, next14Days, today } = useMemo(() => {
    const today = startOfDay(new Date())
    const startRange = subDays(today, 14)
    const rangeDays = Array.from({ length: 29 }, (_, i) => addDays(startRange, i))
    const next14Days = Array.from({ length: 14 }, (_, i) => addDays(today, i)) // Table View: Next 14 days (Operational)
    return { rangeDays, next14Days, today }
  }, [])

  // Enhanced Property Data with Availability Map (Focus on Next 14 days for Table)
  const enrichedProperties = useMemo(() => properties.map(property => {
    const availabilityMap = next14Days.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd')

      // Check Reservation
      const reservation = property.reservas.find(r => {
        if (!r.checkindate || !r.checkoutdate) return false
        const checkIn = parseISO(r.checkindate)
        const checkOut = parseISO(r.checkoutdate)
        // Fix: checkout day is usually free for checkin, so we check < checkout
        return isWithinInterval(date, { start: checkIn, end: subDays(checkOut, 1) })
      })

      // Check Block using Integrated Ocupacao Data
      const ocupacaoData = property.ocupacao?.find(o => o.datas === dateStr)
      const isBlocked = ocupacaoData ? (ocupacaoData.manutencao === 1 || ocupacaoData.ocupado_proprietario === 1) : false

      let status: 'free' | 'occupied' | 'blocked' = 'free'
      if (reservation) status = 'occupied'
      if (isBlocked) status = 'blocked'

      return { date, status, price: property.metricas?.precoMedioNoite || 0, reservation }
    })

    // Gap Detection (Simple: Free day between two occupied/blocked days)
    const availabilityWithGaps = availabilityMap.map((day, index) => {
      if (day.status !== 'free') return day

      const prev = availabilityMap[index - 1]
      const next = availabilityMap[index + 1]

      if (prev && prev.status !== 'free' && next && next.status !== 'free') {
        return { ...day, status: 'gap' as const }
      }
      return day
    })

    return { ...property, availability: availabilityWithGaps }
  }), [properties, next14Days])

  // Metrics Calculation
  const { totalUnits, totalDays, occupiedDays, gapDays, occupancyRate } = useMemo(() => {
    const totalUnits = properties.length
    const totalDays = totalUnits * 14
    let occupiedDays = 0
    let gapDays = 0

    enrichedProperties.forEach(p => {
      occupiedDays += p.availability.filter(d => d.status === 'occupied').length
      gapDays += p.availability.filter(d => d.status === 'gap').length
    })

    const occupancyRate = totalDays > 0 ? (occupiedDays / totalDays) * 100 : 0

    return { totalUnits, totalDays, occupiedDays, gapDays, occupancyRate }
  }, [properties.length, enrichedProperties])


  // Chart Data Aggregation (Stacked Status)
  const statusChartData = useMemo(() => rangeDays.map(date => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const isToday = isSameDay(date, today)

    let occupied = 0
    let blocked = 0
    let available = 0

    properties.forEach(property => {
      // Prioritize Ocupacao Table
      const ocupacaoData = property.ocupacao?.find(o => o.datas === dateStr)

      if (ocupacaoData) {
        if (ocupacaoData.ocupado === 1) occupied++
        else if (ocupacaoData.manutencao === 1 || ocupacaoData.ocupado_proprietario === 1) blocked++
        else available++
      } else {
        // Fallback to reservation logic
        const hasRez = property.reservas.some(r => {
          if (!r.checkindate || !r.checkoutdate) return false
          const checkIn = parseISO(r.checkindate)
          const checkOut = parseISO(r.checkoutdate)
          return isWithinInterval(date, { start: checkIn, end: subDays(checkOut, 1) })
        })
        if (hasRez) occupied++
        else available++ // Assume available if no reservation found in fallback
      }
    })

    return {
      displayDate: format(date, 'dd/MM'),
      fullDate: format(date, "d 'de' MMMM", { locale: ptBR }),
      dateStr, // Added for click handler
      isToday,
      ocupado: occupied,
      bloqueado: blocked,
      disponivel: available,
      total: occupied + blocked + available
    }
  }), [rangeDays, properties, today])

  // Calculate Weekend & Gaps Lists for Dialogs
  const { weekendFreeList, gapsList, nextFri, nextSat } = useMemo(() => {
    const nextFri = nextDay(today, 5)
    const nextSat = addDays(nextFri, 1)
    const friStr = format(nextFri, 'yyyy-MM-dd')
    const satStr = format(nextSat, 'yyyy-MM-dd')

    const weekendFreeList = enrichedProperties.filter(p => {
      const fri = p.availability.find(d => format(d.date, 'yyyy-MM-dd') === friStr)
      const sat = p.availability.find(d => format(d.date, 'yyyy-MM-dd') === satStr)
      return fri?.status === 'free' && sat?.status === 'free'
    })

    const gapsList = enrichedProperties.flatMap(p =>
      p.availability.filter(d => d.status === 'gap').map(d => ({
        property: p,
        date: d.date,
        price: d.price
      }))
    )
    return { weekendFreeList, gapsList, nextFri, nextSat }
  }, [enrichedProperties, today])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-primary/20 rounded-full animate-spin"></div>
          <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-muted-foreground animate-pulse">Carregando disponibilidade...</p>
      </div>
    )
  }

  const getDayDetails = (date: Date) => {
    // ... implementation not needed for click handler, logic is in UnitList
  }

  const handleChartClick = (data: any) => {
    // Scenario 1: Chart Area Click (activePayload from Recharts)
    if (data?.activePayload?.[0]?.payload?.dateStr) {
      const date = parseISO(data.activePayload[0].payload.dateStr)
      if (isValid(date)) {
        setSelectedDate(date);
        // setDialogType('chart'); // Disabled: Show detailed view below chart
      }
    }
    // Scenario 2: Dot/ActiveDot Click (direct payload props)
    else if (data?.payload?.dateStr) {
      const date = parseISO(data.payload.dateStr)
      if (isValid(date)) {
        setSelectedDate(date);
        // setDialogType('chart'); // Disabled: Show detailed view below chart
      }
    }
  }

  // Calculate Weekend & Gaps Lists for Dialogs
  // Calculate Weekend & Gaps Lists for Dialogs


  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Disponibilidade & Oportunidades</h1>
          <p className="text-muted-foreground">Clique no gráfico para ver detalhes das unidades disponíveis.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button>
            <AlertTriangle className="mr-2 h-4 w-4" /> Resolver {gapDays} Gaps
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className="cursor-pointer hover:shadow-md transition-all border-emerald-100 bg-emerald-50/20"
          onClick={() => setDialogType('weekend')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-900">Próximo Fim de Semana Livre</CardTitle>
            <CalendarIcon className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{weekendFreeList.length} Unidades</div>
            <p className="text-xs text-muted-foreground mt-1">
              {format(nextFri, 'dd/MM')} e {format(nextSat, 'dd/MM')} livres
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-all border-orange-100 bg-orange-50/20"
          onClick={() => setDialogType('gaps')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-900">Gaps Identificados</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{gapsList.length} Oportunidades</div>
            <p className="text-xs text-muted-foreground mt-1">Dias isolados entre reservas</p>
          </CardContent>
        </Card>
      </div>

      {/* Occupancy Status Chart */}
      <Card className="hover:shadow-md transition-shadow cursor-pointer border-slate-200">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Composição de Ocupação</CardTitle>
              <CardDescription>Clique em qualquer dia para ver a lista de unidades</CardDescription>
            </div>
            <Badge variant="outline" className="font-normal">
              {rangeDays.length} Dias Visíveis
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={statusChartData}
                margin={{ top: 30, right: 30, left: 0, bottom: 0 }}
                onClick={handleChartClick}
              >
                <defs>
                  <linearGradient id="colorOcupado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="colorDisponivel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="colorBloqueado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="displayDate"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  minTickGap={30}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  domain={[0, totalUnits]}
                />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <RechartsTooltip
                  cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  labelFormatter={(label) => `📅 ${label}`}
                />
                <ReferenceLine x={format(today, 'dd/MM')} stroke="#f97316" strokeDasharray="3 3" label={{ position: 'top', value: 'Hoje', fill: '#f97316', fontSize: 12, fontWeight: 'bold' }} />

                <Area
                  type="monotone"
                  dataKey="ocupado"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="url(#colorOcupado)"
                  name="Ocupado"
                  animationDuration={1000}
                  onClick={handleChartClick}
                  cursor="pointer"
                  activeDot={{ r: 6, strokeWidth: 0, onClick: handleChartClick, cursor: 'pointer' }}
                />
                <Area
                  type="monotone"
                  dataKey="bloqueado"
                  stackId="1"
                  stroke="#94a3b8"
                  fill="url(#colorBloqueado)"
                  name="Bloqueado"
                  animationDuration={1000}
                  onClick={handleChartClick}
                  cursor="pointer"
                  activeDot={{ r: 6, strokeWidth: 0, onClick: handleChartClick, cursor: 'pointer' }}
                />
                {/* Transparent area to capture clicks on 'Available' space without visual clutter */}
                <Area
                  type="monotone"
                  dataKey="disponivel"
                  stackId="1"
                  stroke="transparent"
                  fill="transparent"
                  name="Disponível"
                  activeDot={{ r: 6, strokeWidth: 0, onClick: handleChartClick, cursor: 'pointer' }}
                  onClick={handleChartClick}
                  cursor="pointer"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* DETAILED DAY PANORAMA SECTION */}
      {selectedDate && (
        <DayDetailsSection properties={properties} date={selectedDate} />
      )}

      {/* Details Dialog */}
      <Dialog open={!!dialogType} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'chart' && `Detalhes de ${selectedDate ? format(selectedDate, "d 'de' MMMM", { locale: ptBR }) : ''}`}
              {dialogType === 'weekend' && 'Próximo Fim de Semana Livre'}
              {dialogType === 'gaps' && 'Gaps Identificados'}
            </DialogTitle>
            <DialogDescription>
              {dialogType === 'chart' && 'Visualize as unidades por status nesta data.'}
              {dialogType === 'weekend' && 'Unidades com Sexta e Sábado livres.'}
              {dialogType === 'gaps' && 'Oportunidades de venda em dias isolados.'}
            </DialogDescription>
          </DialogHeader>

          {/* {dialogType === 'chart' && selectedDate && <UnitList properties={properties} date={selectedDate} />} */}
          {dialogType === 'weekend' && <WeekendList list={weekendFreeList} dates={[nextFri, nextSat]} />}
          {dialogType === 'gaps' && <GapsList list={gapsList} />}
        </DialogContent>
      </Dialog>


    </div>
  )
}

function UnitList({ properties, date }: { properties: any[], date: Date }) {
  const dateStr = format(date, 'yyyy-MM-dd')

  const items = useMemo(() => properties.map((property: any) => {
    const ocupacaoData = property.ocupacao?.find((o: any) => o.datas === dateStr)
    let status = 'available'
    let detail = null

    if (ocupacaoData) {
      if (ocupacaoData.ocupado === 1) {
        status = 'occupied'
      } else if (ocupacaoData.manutencao === 1 || ocupacaoData.ocupado_proprietario === 1) {
        status = 'blocked'
      }
    } else {
      const reservation = property.reservas.some((r: any) => {
        if (!r.checkindate || !r.checkoutdate) return false
        const checkIn = parseISO(r.checkindate)
        const checkOut = parseISO(r.checkoutdate)
        const isRez = isWithinInterval(date, { start: checkIn, end: subDays(checkOut, 1) })
        if (isRez) detail = r
        return isRez
      })
      if (reservation) {
        status = 'occupied'
      }
    }
    return { ...property, status, detail }
  }), [properties, dateStr])

  // Filter and Sort
  const available = useMemo(() => items.filter((i: any) => i.status === 'available').sort((a: any, b: any) => (b.metricas?.precoMedioNoite || 0) - (a.metricas?.precoMedioNoite || 0)), [items])
  const occupied = useMemo(() => items.filter((i: any) => i.status === 'occupied'), [items])
  const blocked = useMemo(() => items.filter((i: any) => i.status === 'blocked'), [items])

  const groupedAvailable = useMemo(() => groupByLocationAndGroup(available), [available])

  return (
    <Tabs defaultValue="available" className="w-full flex flex-col h-[500px]">
      <TabsList className="grid w-full grid-cols-3 mb-4">
        <TabsTrigger value="available" className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-900">
          Disponíveis ({available.length})
        </TabsTrigger>
        <TabsTrigger value="occupied" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900">
          Ocupadas ({occupied.length})
        </TabsTrigger>
        <TabsTrigger value="blocked" className="data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">
          Bloqueadas ({blocked.length})
        </TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-y-auto px-1 pb-2 space-y-2">
        <TabsContent value="available" className="space-y-4 mt-0">
          {Object.entries(groupedAvailable).map(([praca, grupos]) => (
            <div key={praca} className="space-y-2">
              <h3 className="font-semibold text-lg text-slate-800 sticky top-0 bg-white z-10 py-2 border-b">{praca}</h3>
              {Object.entries(grupos).map(([grupo, unidades]: [string, any[]]) => (
                <div key={grupo} className="pl-2 border-l-2 border-emerald-100">
                  <h4 className="font-medium text-sm text-slate-600 mb-2 px-2">{grupo}</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {unidades.map((item: any) => (
                      <div key={item.propriedade.idpropriedade} className="flex justify-between items-center p-2 rounded-md bg-emerald-50/30 hover:bg-emerald-50 transition-colors">
                        <a
                          href={`https://beto.stays.com.br/i/apartment/${item.propriedade.idpropriedade}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-emerald-900 truncate pr-2 hover:underline flex items-center gap-1 group"
                        >
                          {item.propriedade.nomepropriedade}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                        </a>
                        <Badge variant="outline" className="bg-white text-emerald-700 border-emerald-200 shrink-0 text-xs">
                          R$ {item.metricas?.precoMedioNoite ? Number(item.metricas.precoMedioNoite).toFixed(0) : '-'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          {available.length === 0 && <div className="flex flex-col items-center justify-center h-40 text-muted-foreground"><p>Nenhuma unidade disponível.</p></div>}
        </TabsContent>

        <TabsContent value="occupied" className="space-y-2 mt-0">
          {occupied.map((item: any) => (
            <div key={item.propriedade.idpropriedade} className="flex flex-col p-3 border rounded-lg bg-blue-50/10 border-blue-100">
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium text-blue-900 text-sm truncate pr-2">{item.propriedade.nomepropriedade}</span>
                <Badge variant="outline" className="bg-white text-blue-700 border-blue-200 shrink-0 text-[10px]">
                  {item.detail ? (item.detail.partnername.length > 15 ? item.detail.partnername.substring(0, 15) + '...' : item.detail.partnername) : 'Ocupado'}
                </Badge>
              </div>
            </div>
          ))}
          {occupied.length === 0 && <div className="flex flex-col items-center justify-center h-40 text-muted-foreground"><p>Nenhuma ocupação.</p></div>}
        </TabsContent>

        <TabsContent value="blocked" className="space-y-2 mt-0">
          {blocked.map((item: any) => (
            <div key={item.propriedade.idpropriedade} className="flex justify-between items-center p-3 border rounded-lg bg-slate-50 border-slate-200 opacity-75">
              <span className="font-medium text-slate-700 text-sm truncate pr-2">{item.propriedade.nomepropriedade}</span>
              <Badge variant="secondary" className="text-slate-500 shrink-0">Bloqueio</Badge>
            </div>
          ))}
          {blocked.length === 0 && <div className="flex flex-col items-center justify-center h-40 text-muted-foreground"><p>Nenhum bloqueio.</p></div>}
        </TabsContent>
      </div>
    </Tabs>
  )
}

function WeekendList({ list, dates }: { list: any[], dates: Date[] }) {
  const grouped = useMemo(() => groupByLocationAndGroup(list), [list])

  return (
    <div className="flex-1 overflow-y-auto space-y-4 p-1">
      <div className="mb-4 p-4 bg-emerald-50 rounded-lg text-emerald-800 text-sm border border-emerald-100">
        Mostrando unidades com <strong>Sexta ({format(dates[0], 'dd/MM')})</strong> e <strong>Sábado ({format(dates[1], 'dd/MM')})</strong> totalmente livres.
      </div>

      {Object.entries(grouped).map(([praca, grupos]) => (
        <div key={praca} className="space-y-2">
          <h3 className="font-semibold text-lg text-slate-800 border-b pb-1">{praca}</h3>
          {Object.entries(grupos).map(([grupo, unidades]: [string, any[]]) => (
            <div key={grupo} className="pl-2">
              <h4 className="font-medium text-sm text-slate-600 mb-2">{grupo}</h4>
              <div className="space-y-2">
                {unidades.map((p: any) => (
                  <div key={p.propriedade.idpropriedade} className="flex justify-between items-center p-3 border rounded-lg hover:shadow-sm bg-white">
                    <a
                      href={`https://beto.stays.com.br/i/apartment/${p.propriedade.idpropriedade}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-emerald-900 hover:underline flex items-center gap-1 group"
                    >
                      {p.propriedade.nomepropriedade}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </a>
                    <Badge className="bg-emerald-600 hover:bg-emerald-700">Disponível</Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {list.length === 0 && <div className="text-center py-10 text-muted-foreground">Nenhuma oportunidade para este fim de semana.</div>}
    </div>
  )
}

function GapsList({ list }: { list: any[] }) {
  const sorted = useMemo(() => [...list].sort((a: any, b: any) => a.date.getTime() - b.date.getTime()), [list])
  const grouped = useMemo(() => groupByLocationAndGroup(sorted), [sorted])

  return (
    <div className="flex-1 overflow-y-auto space-y-4 p-1">
      <div className="mb-4 p-4 bg-orange-50 rounded-lg text-orange-800 text-sm border border-orange-100">
        Gaps são dias isolados (com reservas adjacentes) que podem ser difíceis de vender.
      </div>

      {Object.entries(grouped).map(([praca, grupos]) => (
        <div key={praca} className="space-y-2">
          <h3 className="font-semibold text-lg text-slate-800 border-b pb-1">{praca}</h3>
          {Object.entries(grupos).map(([grupo, items]: [string, any[]]) => (
            <div key={grupo} className="pl-2">
              <h4 className="font-medium text-sm text-slate-600 mb-2">{grupo}</h4>
              <div className="space-y-2">
                {items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-3 border rounded-lg hover:shadow-sm bg-white">
                    <div className="flex flex-col">
                      <a
                        href={`https://beto.stays.com.br/i/apartment/${item.property.propriedade.idpropriedade}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-sm text-slate-800 hover:underline flex items-center gap-1 group"
                      >
                        {item.property.propriedade.nomepropriedade}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                      </a>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        {format(item.date, "dd 'de' MMMM", { locale: ptBR })} ({format(item.date, 'EEEE', { locale: ptBR })})
                      </span>
                    </div>
                    <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                      R$ {item.price}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {sorted.length === 0 && <div className="text-center py-10 text-muted-foreground">Nenhum gap identificado.</div>}
    </div>
  )
}

// Helper to Group Items by Praca -> Grupo
const groupByLocationAndGroup = (items: any[]) => {
  const grouped: Record<string, Record<string, any[]>> = {}
  items.forEach(item => {
    // Handle nested property structure if needed (e.g. for gapsList where item has .propertyWrapper)
    // Check if the item itself has 'propriedade' or if it's nested under 'property'
    const propData = item.propriedade || item.property?.propriedade

    if (!propData) return

    const praca = propData.praca || 'Outros'
    const grupo = propData.grupo_nome || 'Sem Grupo'

    if (!grouped[praca]) grouped[praca] = {}
    if (!grouped[praca][grupo]) grouped[praca][grupo] = []

    grouped[praca][grupo].push(item)
  })
  return grouped
}

function DayDetailsSection({ properties, date }: { properties: any[], date: Date }) {
  const dateStr = format(date, 'yyyy-MM-dd')

  const items = useMemo(() => properties.map((property: any) => {
    const ocupacaoData = property.ocupacao?.find((o: any) => o.datas === dateStr)
    let status = 'available'
    let detail = null

    if (ocupacaoData) {
      if (ocupacaoData.ocupado === 1) {
        status = 'occupied'
      } else if (ocupacaoData.manutencao === 1 || ocupacaoData.ocupado_proprietario === 1) {
        status = 'blocked'
      }
    } else {
      const reservation = property.reservas?.some((r: any) => {
        if (!r.checkindate || !r.checkoutdate) return false
        const checkIn = parseISO(r.checkindate)
        const checkOut = parseISO(r.checkoutdate)
        const isRez = isWithinInterval(date, { start: checkIn, end: subDays(checkOut, 1) })
        if (isRez) detail = r
        return isRez
      })
      if (reservation) {
        status = 'occupied'
      }
    }
    return { ...property, status, detail }
  }), [properties, dateStr])

  // Filter and Sort
  const available = useMemo(() => items.filter((i: any) => i.status === 'available').sort((a: any, b: any) => (b.metricas?.precoMedioNoite || 0) - (a.metricas?.precoMedioNoite || 0)), [items])
  const occupied = useMemo(() => items.filter((i: any) => i.status === 'occupied'), [items])
  const blocked = useMemo(() => items.filter((i: any) => i.status === 'blocked'), [items])

  const groupedAvailable = useMemo(() => groupByLocationAndGroup(available), [available])
  const groupedOccupied = useMemo(() => groupByLocationAndGroup(occupied), [occupied])
  const groupedBlocked = useMemo(() => groupByLocationAndGroup(blocked), [blocked])

  return (
    <div className="space-y-4 animate-in slide-in-from-top-4 duration-500 mt-8 pt-8 border-t border-slate-200" id="day-details-section">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-bold text-slate-900">
          Detalhes do Dia: {format(date, "dd 'de' MMMM", { locale: ptBR })}
        </h2>
        <Badge variant="outline">{items.length} Unidades</Badge>
      </div>

      <Tabs defaultValue="available" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 bg-slate-100/50 p-1">
          <TabsTrigger value="available" className="data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
            Disponíveis ({available.length})
          </TabsTrigger>
          <TabsTrigger value="occupied" className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
            Ocupadas ({occupied.length})
          </TabsTrigger>
          <TabsTrigger value="blocked" className="data-[state=active]:bg-white data-[state=active]:text-slate-700 data-[state=active]:shadow-sm">
            Bloqueadas ({blocked.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="mt-0 space-y-4">
          {Object.entries(groupedAvailable).map(([praca, grupos]) => (
            <div key={praca} className="space-y-3">
              <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
                <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
                {praca}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(grupos).map(([grupo, unidades]: [string, any[]]) => (
                  <div key={grupo} className="col-span-full">
                    <h4 className="font-medium text-sm text-slate-500 uppercase tracking-wider mb-2 mt-1 ml-1">{grupo}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {unidades.map((item: any) => (
                        <Card key={item.propriedade.idpropriedade} className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-all group">
                          <CardContent className="p-4 flex justify-between items-start">
                            <div className="overflow-hidden">
                              <a
                                href={`https://beto.stays.com.br/i/apartment/${item.propriedade.idpropriedade}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-slate-900 hover:text-emerald-700 transition-colors truncate block flex items-center gap-1"
                              >
                                {item.propriedade.nomepropriedade}
                                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                              </a>
                              <p className="text-xs text-muted-foreground mt-1 truncate">{item.propriedade.empreendimento_pousada}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-lg font-bold text-emerald-700">
                                R$ {item.metricas?.precoMedioNoite ? Number(item.metricas.precoMedioNoite).toFixed(0) : '-'}
                              </div>
                              <div className="text-[10px] text-slate-400">diária média</div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {available.length === 0 && <div className="text-center py-12 text-muted-foreground bg-slate-50 rounded-lg border border-dashed">Nenhuma unidade disponível para esta data.</div>}
        </TabsContent>

        <TabsContent value="occupied" className="mt-0 space-y-4">
          {Object.entries(groupedOccupied).map(([praca, grupos]) => (
            <div key={praca} className="space-y-3">
              <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
                <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                {praca}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(grupos).map(([grupo, unidades]: [string, any[]]) => (
                  unidades.map((item: any) => (
                    <Card key={item.propriedade.idpropriedade} className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-slate-900 truncate pr-2" title={item.propriedade.nomepropriedade}>
                            {item.propriedade.nomepropriedade}
                          </span>
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
                            {item.detail ? (item.detail.partnername.length > 10 ? item.detail.partnername.substring(0, 10) + '...' : item.detail.partnername) : 'Ocupado'}
                          </Badge>
                        </div>
                        {item.detail ? (
                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mt-2">
                            <div className="flex flex-col bg-slate-50 p-1.5 rounded">
                              <span className="text-[10px] text-slate-400 uppercase">Hóspedes</span>
                              <span className="font-medium">{item.detail.guesttotalcount || '-'}</span>
                            </div>
                            <div className="flex flex-col bg-slate-50 p-1.5 rounded">
                              <span className="text-[10px] text-slate-400 uppercase">Valor Total</span>
                              <span className="font-medium">R$ {item.detail.reservetotal ? Number(item.detail.reservetotal).toFixed(0) : '-'}</span>
                            </div>
                            <div className="flex flex-col bg-slate-50 p-1.5 rounded col-span-2">
                              <span className="text-[10px] text-slate-400 uppercase">Período</span>
                              <span className="font-medium">
                                {format(parseISO(item.detail.checkindate), 'dd/MM')} - {format(parseISO(item.detail.checkoutdate), 'dd/MM')}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic">Detalhes da reserva indisponíveis</div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ))}
              </div>
            </div>
          ))}
          {occupied.length === 0 && <div className="text-center py-12 text-muted-foreground bg-slate-50 rounded-lg border border-dashed">Nenhuma ocupação para esta data.</div>}
        </TabsContent>

        <TabsContent value="blocked" className="mt-0 space-y-4">
          {Object.entries(groupedBlocked).map(([praca, grupos]) => (
            <div key={praca} className="space-y-3">
              <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
                <div className="w-1 h-6 bg-slate-500 rounded-full"></div>
                {praca}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(grupos).map(([grupo, unidades]: [string, any[]]) => (
                  unidades.map((item: any) => (
                    <Card key={item.propriedade.idpropriedade} className="border-l-4 border-l-slate-400 shadow-sm opacity-75 hover:opacity-100 transition-opacity">
                      <CardContent className="p-4 flex items-center justify-between">
                        <span className="font-medium text-slate-700 truncate pr-2">{item.propriedade.nomepropriedade}</span>
                        <Badge variant="outline" className="text-slate-500">Bloqueio</Badge>
                      </CardContent>
                    </Card>
                  ))
                ))}
              </div>
            </div>
          ))}
          {blocked.length === 0 && <div className="text-center py-12 text-muted-foreground bg-slate-50 rounded-lg border border-dashed">Nenhum bloqueio para esta data.</div>}
        </TabsContent>
      </Tabs>
    </div>
  )
}
