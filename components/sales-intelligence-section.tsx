'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    Cell,
} from 'recharts'
import {
    TrendingUp,
    MapPin,
    Phone,
    Calendar,
    Users,
    CheckCircle,
    Clock,
    Flame,
    Target,
    ExternalLink,
    Building2,
    CalendarDays,
    Filter,
    X,
} from 'lucide-react'
import useSWR from 'swr'
import { InitialLoadingScreen } from '@/components/page-skeleton'

// ─── TYPES ──────────────────────────────────────────────────────────────────────

interface CotacaoData {
    id: string
    chatId: number
    cliente: string | null
    telefone: string | null
    phoneNormalized: string | null
    canal: string
    destino: string | null
    pracaNormalized: string
    checkIn: string | null
    checkOut: string | null
    datesParseable: boolean
    hospedes: number | null
    nightsRequested: number | null
    leadTimeDays: number | null
    dataCotacao: string
    idreserva: string | null
    conversionType: 'converted' | 'none'
    timeSlot: string
    dayOfWeek: string
    dayOfWeekNum: number
    checkInWeek: number | null
    checkInYear: number | null
    matchedReserva: {
        idReserva: string
        propertyName: string
        partnerName: string
        reserveTotal: number
        creationDate: string
        checkIn: string
        checkOut: string
    } | null
}

interface WeekData {
    key: string
    week: number
    year: number
    count: number
    topDestinos: { name: string; count: number }[]
}

interface AnalyticsData {
    overview: {
        totalCotacoes: number
        cotacoesHoje: number
        cotacoesOntem: number
        cotacoes30d: number
        avgCotacoesDia: number
    }
    conversion: {
        totalConverted: number
        matchedCount: number
        conversionRateTotal: number
        matchedRevenue: number
    }
    demand: {
        byDestino: { name: string; total: number; converted: number; revenue: number; conversionRate: number }[]
        byCanal: { name: string; total: number; converted: number; conversionRate: number }[]
        byPartner: { name: string; total: number; revenue: number }[]
        byCheckInMonth: { month: string; count: number }[]
        byCheckInWeek: WeekData[]
    }
    behavior: {
        avgLeadTimeDays: number
        avgHospedes: number
        parseableRate: number
        hotCotacoes: number
        dailyVolume: { date: string; cotacoes: number; converted: number }[]
        heatmapData: { day: string; Manhã: number; Tarde: number; Noite: number; total: number }[]
    }
    filters: {
        canais: string[]
        destinos: string[]
    }
}

interface CotacoesResponse {
    success: boolean
    cotacoes: CotacaoData[]
    analytics: AnalyticsData
    matchInfo: {
        totalReservasSearched: number
        totalPhonesInCotacoes: number
        totalPhonesInReservas: number
        matchesFound: number
    }
}

// ─── DRILL-DOWN TYPES ───────────────────────────────────────────────────────────

type DrillDownKey =
    | 'cotacoes30d' | 'mediaDia' | 'conversao' | 'receita' | 'quentes'
    | 'funnel_converted' | 'funnel_open'
    | { type: 'day'; date: string }
    | { type: 'destino'; name: string }
    | { type: 'canal'; name: string }
    | { type: 'checkin_month'; month: string }
    | { type: 'checkin_week'; key: string }
    | { type: 'partner'; name: string }
    | { type: 'daytime'; day: string; slot: string }
    | null

function getDrillDownTitle(key: DrillDownKey): string {
    if (!key) return ''
    if (typeof key === 'string') {
        const titles: Record<string, string> = {
            cotacoes30d: 'Cotações dos últimos 30 dias',
            mediaDia: 'Cotações dos últimos 30 dias',
            conversao: 'Cotações Convertidas',
            receita: 'Receita por Match de Telefone',
            quentes: 'Cotações Quentes (48h)',
            funnel_converted: 'Cotações Convertidas',
            funnel_open: 'Cotações em Aberto',
        }
        return titles[key] || ''
    }
    switch (key.type) {
        case 'day': return `Cotações em ${new Date(key.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`
        case 'destino': return `Cotações para ${key.name}`
        case 'canal': return `Cotações via ${key.name}`
        case 'checkin_month': {
            const [y, m] = key.month.split('-')
            const d = new Date(parseInt(y), parseInt(m) - 1, 1)
            return `Check-in em ${d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
        }
        case 'checkin_week': return `Check-in na semana ${key.key}`
        case 'partner': return `Conversões via ${key.name}`
        case 'daytime': return `Cotações de ${key.day} — ${key.slot}`
        default: return ''
    }
}

function filterCotacoes(cotacoes: CotacaoData[], key: DrillDownKey): CotacaoData[] {
    if (!key) return []
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 3600000).toISOString()

    if (typeof key === 'string') {
        switch (key) {
            case 'cotacoes30d':
            case 'mediaDia':
                return cotacoes.filter(c => c.dataCotacao >= thirtyDaysAgo)
            case 'conversao':
            case 'funnel_converted':
                return cotacoes.filter(c => c.conversionType === 'converted')
            case 'receita':
                return cotacoes.filter(c => c.conversionType === 'converted' && c.matchedReserva)
            case 'quentes':
                return cotacoes.filter(c => c.conversionType === 'none' && c.dataCotacao >= fortyEightHoursAgo)
            case 'funnel_open':
                return cotacoes.filter(c => c.conversionType === 'none')
            default: return []
        }
    }
    switch (key.type) {
        case 'day': return cotacoes.filter(c => c.dataCotacao.split('T')[0] === key.date)
        case 'destino': return cotacoes.filter(c => c.pracaNormalized === key.name)
        case 'canal': return cotacoes.filter(c => c.canal === key.name)
        case 'checkin_month': return cotacoes.filter(c => c.checkIn && c.checkIn.startsWith(key.month))
        case 'checkin_week': return cotacoes.filter(c => c.checkInWeek && c.checkInYear && `${c.checkInYear}-W${String(c.checkInWeek).padStart(2, '0')}` === key.key)
        case 'partner': return cotacoes.filter(c => c.matchedReserva?.partnerName === key.name)
        case 'daytime': {
            const dayNumMap: Record<string, number> = { 'Dom': 0, 'Seg': 1, 'Ter': 2, 'Qua': 3, 'Qui': 4, 'Sex': 5, 'Sáb': 6 }
            const dayNum = dayNumMap[key.day]
            return cotacoes.filter(c => c.dayOfWeekNum === dayNum && c.timeSlot === key.slot)
        }
        default: return []
    }
}

// ─── COLORS ─────────────────────────────────────────────────────────────────────

const CHART_PRIMARY = 'hsl(var(--primary))'
const CHART_EMERALD = '#10b981'

// ─── FETCHER ────────────────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(res => res.json())

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────────

export function SalesIntelligenceSection() {
    const [drillDown, setDrillDown] = useState<DrillDownKey>(null)
    const [filterCanal, setFilterCanal] = useState<string>('')
    const [filterDestino, setFilterDestino] = useState<string>('')

    const [isFirstLoad, setIsFirstLoad] = useState(true)

    const { data, error, isLoading } = useSWR<CotacoesResponse>(
        '/api/cotacoes',
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 300000,
            refreshInterval: 5 * 60 * 1000,
            onSuccess: () => setIsFirstLoad(false)
        }
    )

    const drillDownCotacoes = useMemo(() => {
        if (!drillDown || !data?.cotacoes) return []
        return filterCotacoes(data.cotacoes, drillDown)
    }, [drillDown, data?.cotacoes])

    // Apply local filters
    const filteredCotacoes = useMemo(() => {
        if (!data?.cotacoes) return []
        let result = data.cotacoes
        if (filterCanal) result = result.filter(c => c.canal === filterCanal)
        if (filterDestino) result = result.filter(c => c.pracaNormalized === filterDestino)
        return result
    }, [data?.cotacoes, filterCanal, filterDestino])

    if (isFirstLoad && isLoading) return <InitialLoadingScreen />
    if (error || !data?.success || !data?.analytics) {
        return (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm border border-dashed rounded-xl">
                Erro ao carregar dados de cotações.
            </div>
        )
    }

    const { analytics, matchInfo } = data
    const hasFilters = !!filterCanal || !!filterDestino
    const showRevenue = typeof drillDown === 'string' && (drillDown === 'receita' || drillDown === 'funnel_converted' || drillDown === 'conversao')
        || (typeof drillDown === 'object' && drillDown !== null && drillDown.type === 'partner')

    return (
        <div className="space-y-5">
            {/* ─── FILTERS ──────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <select
                    value={filterCanal}
                    onChange={e => setFilterCanal(e.target.value)}
                    className="h-8 text-xs border rounded-md px-2 bg-background"
                >
                    <option value="">Todos os canais</option>
                    {analytics.filters.canais.map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
                <select
                    value={filterDestino}
                    onChange={e => setFilterDestino(e.target.value)}
                    className="h-8 text-xs border rounded-md px-2 bg-background"
                >
                    <option value="">Todos os destinos</option>
                    {analytics.filters.destinos.map(d => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>
                {hasFilters && (
                    <button
                        onClick={() => { setFilterCanal(''); setFilterDestino('') }}
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 border rounded-md"
                    >
                        <X className="h-3 w-3" /> Limpar
                    </button>
                )}
                <span className="text-[11px] text-muted-foreground ml-auto">
                    {hasFilters ? `${filteredCotacoes.length} de ${analytics.overview.totalCotacoes}` : `${analytics.overview.totalCotacoes} cotações`}
                </span>
            </div>

            {/* ─── KPI ROW ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <MetricCard
                    label="Cotações (30d)"
                    value={analytics.overview.cotacoes30d}
                    sub={`${analytics.overview.cotacoesHoje} hoje · ${analytics.overview.cotacoesOntem} ontem`}
                    onClick={() => setDrillDown('cotacoes30d')}
                />
                <MetricCard
                    label="Média / Dia"
                    value={analytics.overview.avgCotacoesDia.toFixed(1)}
                    sub="últimos 30 dias"
                    onClick={() => setDrillDown('mediaDia')}
                />
                <MetricCard
                    label="Taxa de Conversão"
                    value={`${analytics.conversion.conversionRateTotal.toFixed(1)}%`}
                    sub={`${analytics.conversion.totalConverted} de ${analytics.overview.totalCotacoes}`}
                    highlight={analytics.conversion.conversionRateTotal >= 15}
                    onClick={() => setDrillDown('conversao')}
                />
                <MetricCard
                    label="Receita Matched"
                    value={`R$ ${(analytics.conversion.matchedRevenue / 1000).toFixed(0)}k`}
                    sub={`${analytics.conversion.matchedCount} matches`}
                    onClick={() => setDrillDown('receita')}
                />
                <MetricCard
                    label="Cotações Quentes"
                    value={analytics.behavior.hotCotacoes}
                    sub="sem conversão 48h"
                    alert={analytics.behavior.hotCotacoes > 5}
                    onClick={() => setDrillDown('quentes')}
                />
            </div>

            {/* ─── FUNNEL ─────────────────────────────────────────────── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        Funil de Conversão
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ConversionFunnel analytics={analytics} onSegmentClick={(key) => setDrillDown(key)} />
                </CardContent>
            </Card>

            {/* ─── ROW 1: Volume + Destino ────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <Card className="lg:col-span-3">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            Volume Diário
                            <span className="text-xs font-normal text-muted-foreground ml-auto">30 dias</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DailyVolumeChart data={analytics.behavior.dailyVolume} onDayClick={(date) => setDrillDown({ type: 'day', date })} />
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            Demanda por Destino
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DemandByDestination data={analytics.demand.byDestino} onClick={(name) => setDrillDown({ type: 'destino', name })} />
                    </CardContent>
                </Card>
            </div>

            {/* ─── ROW 2: Canais + Partners + DayTime ─────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            Canais de Origem
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CanalDistribution data={analytics.demand.byCanal} onClick={(name) => setDrillDown({ type: 'canal', name })} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            Canais de Venda (Conversão)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <PartnerConversion data={analytics.demand.byPartner} onClick={(name) => setDrillDown({ type: 'partner', name })} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            Volume por Dia × Turno
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DayTimeHeatmap data={analytics.behavior.heatmapData} onCellClick={(day, slot) => setDrillDown({ type: 'daytime', day, slot })} />
                    </CardContent>
                </Card>
            </div>

            {/* ─── ROW 3: Check-in Week Bubble + Check-in Month + Behavior ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            Para Quando Estão Comprando (Semanas)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CheckInWeekChart data={analytics.demand.byCheckInWeek} onWeekClick={(key) => setDrillDown({ type: 'checkin_week', key })} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            Comportamento
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <BehaviorStats analytics={analytics} />
                    </CardContent>
                </Card>
            </div>

            {/* ─── RECENT TABLE ────────────────────────────────────────── */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            Cotações Recentes
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] gap-1 font-normal">
                            {matchInfo.matchesFound} matches
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <CotacoesTable cotacoes={filteredCotacoes.slice(0, 15)} showRevenue={false} />
                </CardContent>
            </Card>

            {/* ─── DRILL-DOWN DIALOG ──────────────────────────────────── */}
            <Dialog open={drillDown !== null} onOpenChange={(open) => { if (!open) setDrillDown(null) }}>
                <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                    {drillDown && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="text-base">{getDrillDownTitle(drillDown)}</DialogTitle>
                                <DialogDescription className="text-xs">
                                    {drillDownCotacoes.length} resultado{drillDownCotacoes.length !== 1 ? 's' : ''}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex-1 overflow-y-auto mt-2">
                                {drillDown && typeof drillDown === 'object' && drillDown.type === 'checkin_week' && (
                                    <CheckInWeekSummary cotacoes={drillDownCotacoes} />
                                )}
                                <CotacoesTable cotacoes={drillDownCotacoes} showRevenue={!!showRevenue} />
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ─── SUB-COMPONENTS ─────────────────────────────────────────────────────────────

function MetricCard({
    label, value, sub, highlight = false, alert = false, onClick,
}: {
    label: string; value: string | number; sub: string
    highlight?: boolean; alert?: boolean; onClick?: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`p-4 rounded-xl border bg-card transition-all text-left w-full
                hover:border-primary/40 hover:shadow-sm active:scale-[0.98] cursor-pointer
                ${alert ? 'border-orange-300 dark:border-orange-700' : ''}`}
        >
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-semibold tracking-tight ${highlight ? 'text-emerald-600 dark:text-emerald-400' : ''} ${alert ? 'text-orange-600 dark:text-orange-400' : ''}`}>
                {value}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
        </button>
    )
}

function ConversionFunnel({ analytics, onSegmentClick }: { analytics: AnalyticsData; onSegmentClick: (key: 'funnel_converted' | 'funnel_open') => void }) {
    const { overview, conversion } = analytics
    const total = overview.totalCotacoes
    const converted = conversion.matchedCount
    const open = total - converted
    const pctConverted = total > 0 ? (converted / total) * 100 : 0

    return (
        <div className="space-y-3">
            <div className="h-5 w-full rounded-full overflow-hidden flex bg-muted/30">
                {converted > 0 && (
                    <button
                        type="button"
                        onClick={() => onSegmentClick('funnel_converted')}
                        className="bg-emerald-500 hover:bg-emerald-400 transition-all duration-500 cursor-pointer"
                        style={{ width: `${pctConverted}%` }}
                        title={`Convertido: ${converted}`}
                    />
                )}
                <button
                    type="button"
                    onClick={() => onSegmentClick('funnel_open')}
                    className="flex-1 hover:bg-muted/50 transition-all cursor-pointer"
                    title={`Em aberto: ${open}`}
                />
            </div>
            <div className="flex gap-6 text-xs">
                <button onClick={() => onSegmentClick('funnel_converted')} className="flex items-center gap-2 hover:underline cursor-pointer">
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    <span className="text-muted-foreground">Convertido</span>
                    <span className="font-semibold">{converted}</span>
                    <span className="text-[10px] text-muted-foreground">({pctConverted.toFixed(1)}%)</span>
                </button>
                <button onClick={() => onSegmentClick('funnel_open')} className="flex items-center gap-2 hover:underline cursor-pointer">
                    <div className="w-2.5 h-2.5 rounded-sm bg-muted" />
                    <span className="text-muted-foreground">Em aberto</span>
                    <span className="font-semibold">{open}</span>
                    <span className="text-[10px] text-muted-foreground">({(100 - pctConverted).toFixed(1)}%)</span>
                </button>
            </div>
        </div>
    )
}

function DemandByDestination({ data, onClick }: { data: AnalyticsData['demand']['byDestino']; onClick: (name: string) => void }) {
    const top = data.slice(0, 8)
    const maxVal = Math.max(...top.map(d => d.total), 1)

    return (
        <div className="space-y-2.5">
            {top.map((d) => (
                <button key={d.name} type="button" onClick={() => onClick(d.name)} className="w-full text-left hover:bg-muted/30 rounded-md px-1 -mx-1 py-0.5 transition-colors cursor-pointer">
                    <div className="flex justify-between items-baseline">
                        <span className="text-xs font-medium truncate max-w-[180px]">{d.name}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs tabular-nums">{d.total}</span>
                            {d.converted > 0 && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal">
                                    {d.conversionRate.toFixed(0)}%
                                </Badge>
                            )}
                        </div>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1">
                        <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${(d.total / maxVal) * 100}%` }} />
                    </div>
                </button>
            ))}
        </div>
    )
}

function DailyVolumeChart({ data, onDayClick }: { data: AnalyticsData['behavior']['dailyVolume']; onDayClick: (date: string) => void }) {
    const chartData = data.map(d => ({
        ...d,
        dateLabel: new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    }))

    return (
        <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}
                    onClick={(e: any) => { if (e?.activePayload?.[0]) onDayClick(e.activePayload[0].payload.date) }}
                    style={{ cursor: 'pointer' }}
                >
                    <defs>
                        <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_PRIMARY} stopOpacity={0.15} />
                            <stop offset="95%" stopColor={CHART_PRIMARY} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_EMERALD} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={CHART_EMERALD} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={28} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px', background: 'hsl(var(--card))' }} />
                    <Area type="monotone" dataKey="cotacoes" stroke={CHART_PRIMARY} fill="url(#volGrad)" strokeWidth={1.5} name="Cotações" />
                    <Area type="monotone" dataKey="converted" stroke={CHART_EMERALD} fill="url(#convGrad)" strokeWidth={1.5} name="Convertidas" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}

function CanalDistribution({ data, onClick }: { data: AnalyticsData['demand']['byCanal']; onClick: (name: string) => void }) {
    const total = data.reduce((sum, d) => sum + d.total, 0)

    return (
        <div className="space-y-3">
            {data.slice(0, 6).map((canal) => {
                const pct = total > 0 ? (canal.total / total) * 100 : 0
                return (
                    <button key={canal.name} type="button" onClick={() => onClick(canal.name)} className="w-full text-left hover:bg-muted/30 rounded-md px-1 -mx-1 py-0.5 transition-colors cursor-pointer">
                        <div className="flex justify-between items-baseline">
                            <span className="text-xs truncate max-w-[160px]">{canal.name}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] tabular-nums text-muted-foreground">{canal.total}</span>
                                <span className="text-[10px] tabular-nums font-medium">{pct.toFixed(0)}%</span>
                            </div>
                        </div>
                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden mt-1">
                            <div className="h-full rounded-full bg-primary/50 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                    </button>
                )
            })}
        </div>
    )
}

function PartnerConversion({ data, onClick }: { data: AnalyticsData['demand']['byPartner']; onClick: (name: string) => void }) {
    if (data.length === 0) {
        return <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">Sem conversões</div>
    }

    const maxVal = Math.max(...data.map(d => d.total), 1)

    return (
        <div className="space-y-3">
            {data.map((p) => (
                <button key={p.name} type="button" onClick={() => onClick(p.name)} className="w-full text-left hover:bg-muted/30 rounded-md px-1 -mx-1 py-0.5 transition-colors cursor-pointer">
                    <div className="flex justify-between items-baseline">
                        <span className="text-xs font-medium">{p.name}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs tabular-nums">{p.total} vendas</span>
                            <span className="text-[10px] tabular-nums text-muted-foreground">R$ {(p.revenue / 1000).toFixed(0)}k</span>
                        </div>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1">
                        <div className="h-full rounded-full bg-emerald-500/60 transition-all" style={{ width: `${(p.total / maxVal) * 100}%` }} />
                    </div>
                </button>
            ))}
        </div>
    )
}

function DayTimeHeatmap({ data, onCellClick }: { data: AnalyticsData['behavior']['heatmapData']; onCellClick: (day: string, slot: string) => void }) {
    const maxVal = Math.max(...data.flatMap(d => [d.Manhã, d.Tarde, d.Noite]), 1)

    function getCellColor(value: number) {
        if (value === 0) return 'bg-muted/30'
        const intensity = Math.min(value / maxVal, 1)
        if (intensity < 0.25) return 'bg-primary/15'
        if (intensity < 0.5) return 'bg-primary/30'
        if (intensity < 0.75) return 'bg-primary/50'
        return 'bg-primary/80'
    }

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-[40px_1fr_1fr_1fr] gap-1 text-[10px] text-muted-foreground mb-1">
                <div />
                <div className="text-center">Manhã</div>
                <div className="text-center">Tarde</div>
                <div className="text-center">Noite</div>
            </div>
            {data.map(row => (
                <div key={row.day} className="grid grid-cols-[40px_1fr_1fr_1fr] gap-1">
                    <div className="text-[10px] text-muted-foreground flex items-center">{row.day}</div>
                    {(['Manhã', 'Tarde', 'Noite'] as const).map(slot => (
                        <button
                            key={slot}
                            type="button"
                            onClick={() => row[slot] > 0 && onCellClick(row.day, slot)}
                            className={`h-7 rounded-md flex items-center justify-center text-[10px] font-medium transition-all
                                ${getCellColor(row[slot])}
                                ${row[slot] > 0 ? 'text-foreground cursor-pointer hover:ring-1 hover:ring-primary/40 active:scale-95' : 'text-muted-foreground/50 cursor-default'}`}
                        >
                            {row[slot] > 0 ? row[slot] : ''}
                        </button>
                    ))}
                </div>
            ))}
        </div>
    )
}

function getWeekDateRange(year: number, week: number): { start: Date; end: Date } {
    // ISO week: week 1 is the week containing the first Thursday of the year
    const jan4 = new Date(year, 0, 4)
    const dayOfWeek = jan4.getDay() || 7 // Mon=1..Sun=7
    const mondayOfWeek1 = new Date(jan4)
    mondayOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1)
    const start = new Date(mondayOfWeek1)
    start.setDate(mondayOfWeek1.getDate() + (week - 1) * 7)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start, end }
}

function formatDateShort(d: Date): string {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function CheckInWeekChart({ data, onWeekClick }: { data: WeekData[]; onWeekClick: (key: string) => void }) {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentWeek = getISOWeek(now)

    // Calculate max week key (52 weeks from now)
    const maxYear = currentYear + 1
    const maxWeek = currentWeek

    // Filter: only future/current weeks within the next 52 weeks, with data
    const filtered = data.filter(d => {
        // Must be current week or later
        if (d.year < currentYear || (d.year === currentYear && d.week < currentWeek)) return false
        // Must be within 52 weeks from now
        if (d.year > maxYear || (d.year === maxYear && d.week > maxWeek)) return false
        return true
    })

    if (filtered.length === 0) {
        return <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">Sem cotações para as próximas semanas</div>
    }

    const chartData = filtered.map(d => {
        const { start, end } = getWeekDateRange(d.year, d.week)
        const rangeLabel = `${formatDateShort(start)} – ${formatDateShort(end)}`
        return {
            ...d,
            label: rangeLabel,
            shortLabel: `${formatDateShort(start).substring(0, 5)}`,
            fullLabel: `${rangeLabel} (S${d.week}/${d.year})`,
        }
    })

    return (
        <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: -10, right: 4, top: 4, bottom: 0 }}
                    onClick={(e: any) => { if (e?.activePayload?.[0]) onWeekClick(e.activePayload[0].payload.key) }}
                    style={{ cursor: 'pointer' }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                        dataKey="shortLabel"
                        tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        interval={chartData.length > 12 ? Math.floor(chartData.length / 10) : 0}
                        angle={chartData.length > 10 ? -35 : 0}
                        textAnchor={chartData.length > 10 ? 'end' : 'middle'}
                        height={chartData.length > 10 ? 45 : 25}
                    />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={28} axisLine={false} tickLine={false} />
                    <RechartsTooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px', background: 'hsl(var(--card))' }}
                        content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null
                            const d = payload[0].payload as (typeof chartData)[0]
                            return (
                                <div className="bg-card border rounded-lg p-3 shadow-md text-xs min-w-[160px]">
                                    <p className="font-medium mb-1">{d.fullLabel}</p>
                                    <p className="text-sm font-semibold">{d.count} cotações</p>
                                    {d.topDestinos.length > 0 && (
                                        <div className="mt-2 pt-2 border-t space-y-0.5">
                                            <p className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1">Destinos</p>
                                            {d.topDestinos.map(td => (
                                                <div key={td.name} className="flex justify-between gap-3">
                                                    <span className="text-muted-foreground truncate">{td.name}</span>
                                                    <span className="font-medium tabular-nums">{td.count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        }}
                    />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]} name="Cotações">
                        {chartData.map((entry, idx) => {
                            const isNear = idx < 4
                            return <Cell key={idx} fill={isNear ? CHART_PRIMARY : `hsl(var(--primary) / ${Math.max(0.25, 0.7 - idx * 0.02)})`} />
                        })}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function BehaviorStats({ analytics }: { analytics: AnalyticsData }) {
    const items = [
        { label: 'Antecedência', value: `${analytics.behavior.avgLeadTimeDays.toFixed(0)}d`, icon: <Calendar className="h-3.5 w-3.5" /> },
        { label: 'Hóspedes', value: analytics.behavior.avgHospedes.toFixed(1), icon: <Users className="h-3.5 w-3.5" /> },
        { label: 'Datas válidas', value: `${analytics.behavior.parseableRate.toFixed(0)}%`, icon: <CheckCircle className="h-3.5 w-3.5" /> },
        { label: 'Quentes (48h)', value: String(analytics.behavior.hotCotacoes), icon: <Flame className="h-3.5 w-3.5" /> },
    ]

    return (
        <div className="grid grid-cols-2 gap-3">
            {items.map(item => (
                <div key={item.label} className="p-3 rounded-lg bg-muted/30 border">
                    <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
                        {item.icon}
                        <span className="text-[10px] uppercase font-medium tracking-wide">{item.label}</span>
                    </div>
                    <p className="text-lg font-semibold">{item.value}</p>
                </div>
            ))}
        </div>
    )
}

function CheckInWeekSummary({ cotacoes }: { cotacoes: CotacaoData[] }) {
    if (cotacoes.length === 0) return null;

    // Group by Destino
    const byDestino = cotacoes.reduce((acc, c) => {
        const d = c.pracaNormalized || 'Outros';
        acc[d] = (acc[d] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const topDestinos = Object.entries(byDestino).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Group by Data Cotação
    const byDate = cotacoes.reduce((acc, c) => {
        const d = c.dataCotacao.split('T')[0];
        acc[d] = (acc[d] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const topDates = Object.entries(byDate).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()).slice(0, 5);

    return (
        <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-muted/10 border rounded-lg">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Predominância de Destinos</h4>
                <div className="space-y-1.5">
                    {topDestinos.map(([name, count]) => (
                        <div key={name} className="flex justify-between items-center text-sm">
                            <span className="truncate max-w-[150px]">{name}</span>
                            <span className="font-medium whitespace-nowrap tabular-nums">{count} cot{count !== 1 ? 's' : ''}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="p-3 bg-muted/10 border rounded-lg">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Cotações Realizadas Em</h4>
                <div className="space-y-1.5">
                    {topDates.map(([date, count]) => (
                        <div key={date} className="flex justify-between items-center text-sm">
                            <span>{new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                            <span className="font-medium whitespace-nowrap tabular-nums">{count} cot{count !== 1 ? 's' : ''}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function CotacoesTable({ cotacoes, showRevenue = false }: { cotacoes: CotacaoData[]; showRevenue?: boolean }) {
    if (cotacoes.length === 0) {
        return <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Nenhuma cotação encontrada.</div>
    }

    return (
        <div className="max-h-[400px] overflow-y-auto">
            <div className="overflow-x-auto">
                <Table className="min-w-[650px]">
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow className="h-8">
                            <TableHead className="text-[10px]">Cliente</TableHead>
                            <TableHead className="text-[10px]">Canal</TableHead>
                            <TableHead className="text-[10px]">Destino</TableHead>
                            <TableHead className="text-[10px]">Check-in</TableHead>
                            <TableHead className="text-[10px]">Data</TableHead>
                            <TableHead className="text-[10px] text-center">Status</TableHead>
                            {showRevenue && <TableHead className="text-[10px] text-right">Receita</TableHead>}
                            <TableHead className="text-[10px]">Match</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {cotacoes.map((cot) => (
                            <TableRow key={cot.id} className="h-9">
                                <TableCell className="text-xs py-1.5">
                                    <div className="flex flex-col">
                                        <span className="font-medium truncate max-w-[100px]" title={cot.cliente || ''}>
                                            {cot.cliente || '—'}
                                        </span>
                                        {cot.telefone && <span className="text-[10px] text-muted-foreground">{cot.telefone}</span>}
                                    </div>
                                </TableCell>
                                <TableCell className="text-[11px] py-1.5 text-muted-foreground">{cot.canal}</TableCell>
                                <TableCell className="text-xs py-1.5">{cot.pracaNormalized}</TableCell>
                                <TableCell className="text-xs py-1.5 tabular-nums">
                                    {cot.checkIn
                                        ? new Date(cot.checkIn + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                        : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell className="text-xs py-1.5 tabular-nums text-muted-foreground">
                                    {new Date(cot.dataCotacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </TableCell>
                                <TableCell className="py-1.5 text-center">
                                    {cot.conversionType === 'converted' && cot.matchedReserva ? (
                                        <a href={`https://app.quartoavista.com.br/${cot.matchedReserva.idReserva}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 group">
                                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[10px] h-5 px-1.5 font-medium group-hover:bg-emerald-500/20 transition-colors">
                                                Convertido <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                                            </Badge>
                                        </a>
                                    ) : cot.conversionType === 'converted' ? (
                                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[10px] h-5 px-1.5 font-medium">Convertido</Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground">Aberto</Badge>
                                    )}
                                </TableCell>
                                {showRevenue && (
                                    <TableCell className="text-xs py-1.5 text-right font-medium tabular-nums">
                                        {cot.matchedReserva ? (
                                            <a href={`https://app.quartoavista.com.br/${cot.matchedReserva.idReserva}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                                                R$ {cot.matchedReserva.reserveTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        ) : '—'}
                                    </TableCell>
                                )}
                                <TableCell className="text-[11px] py-1.5">
                                    {cot.matchedReserva ? (
                                        <a href={`https://app.quartoavista.com.br/${cot.matchedReserva.idReserva}`} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-primary hover:underline truncate max-w-[120px]">
                                            <span className="truncate">{cot.matchedReserva.propertyName.substring(0, 18)}…</span>
                                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                        </a>
                                    ) : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

// ─── SKELETON ───────────────────────────────────────────────────────────────────

function SalesIntelligenceSkeleton() {
    return (
        <div className="space-y-5">
            <div className="h-8 w-48 bg-muted/30 animate-pulse rounded" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-[88px] bg-muted/20 animate-pulse rounded-xl border" />
                ))}
            </div>
            <div className="h-[120px] bg-muted/10 animate-pulse rounded-xl border" />
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="h-[280px] bg-muted/10 animate-pulse rounded-xl border lg:col-span-3" />
                <div className="h-[280px] bg-muted/10 animate-pulse rounded-xl border lg:col-span-2" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-[240px] bg-muted/10 animate-pulse rounded-xl border" />
                ))}
            </div>
        </div>
    )
}
