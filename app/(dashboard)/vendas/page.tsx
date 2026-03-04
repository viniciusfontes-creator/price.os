'use client';

import { useEffect, useMemo, useState } from "react"
import { useDashboardData } from "@/contexts/dashboard-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, Calendar, CheckCircle, DollarSign, Target, TrendingUp, Activity, ShoppingBag, AlertTriangle, ExternalLink, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    ComposedChart,
    Line,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer,
    Cell
} from 'recharts'
import { FilterBar } from "@/components/filters/filter-bar"
import { useGlobalFilters } from "@/contexts/global-filters-context"
import { applyGlobalFilters, getFilterOptions } from "@/lib/filter-utils"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { SalesUnitPerformance, SalesMetrics } from "@/types"
import useSWR from "swr"
import Link from "next/link"
import { AvailabilityCalendar, PricingPeriod } from "@/components/availability-calendar"
import { CompetitorAnalysisCard } from "@/components/competitor-analysis-card"

const CHART_COLORS = ['#2563eb', '#16a34a', '#db2777', '#ea580c', '#7c3aed', '#0891b2']

function InitialLoadingScreen() {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-primary/20 rounded-full animate-spin"></div>
                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-muted-foreground animate-pulse">Carregando inteligência de vendas...</p>
        </div>
    )
}

function VendasSkeleton() {
    return (
        <div className="space-y-6">
            <div className="h-20 w-full bg-muted/20 animate-pulse rounded-lg" />
            <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted/20 animate-pulse rounded-lg" />)}
            </div>
            <div className="h-[400px] bg-muted/20 animate-pulse rounded-lg" />
        </div>
    )
}

interface BasketItem {
    id: string;
    basket_id: string;
    item_type: string;
    internal_property_id?: string;
    airbnb_listing_id?: string;
    is_primary: boolean;
    airbnb_data?: {
        preco_por_noite: number;
        preco_total: number;
        quantidade_noites: number;
        nome_anuncio?: string;
    };
    history?: any[];
}

interface Basket {
    id: string;
    name: string;
    basket_items?: BasketItem[];
}

interface GroupPerformance {
    name: string;
    praca: string;
    revenue: number;
    target: number;
    percentAchieved: number;
    unitCount: number;
    units: SalesUnitPerformance[];
}

export default function SalesPage() {
    const { data: rawData, loading: dashboardLoading, isFirstLoad } = useDashboardData()
    const [selectedUnit, setSelectedUnit] = useState<SalesUnitPerformance | null>(null)
    const { filters, updateFilters } = useGlobalFilters()

    // Force creation date mode for this page
    useEffect(() => {
        if (filters.dateFilterMode !== 'saleDate') {
            updateFilters({ dateFilterMode: 'saleDate' })
        }
    }, [])

    // Apply global filters to data
    const filteredData = useMemo(
        () => applyGlobalFilters(rawData, filters),
        [rawData, filters]
    )

    // Get filter options from data
    const filterOptions = useMemo(
        () => getFilterOptions(rawData),
        [rawData]
    )

    const [metrics, setMetrics] = useState<SalesMetrics>({
        revenueMTD: 0,
        revenueTarget: 0,
        percentOfTarget: 0,
        revenueToday: 0,
        percentOfDailyPace: 0,
        dailyPaceRequired: 0,
        unitsAtRisk: 0,
        averageTicket: 0,
        averageLeadTime: 0,
    })
    const [units, setUnits] = useState<SalesUnitPerformance[]>([])
    const [chartData, setChartData] = useState<{ dia: number; realizado: number | null; meta: number }[]>([])
    const [partnerData, setPartnerData] = useState<{
        name: string;
        value: number;
        daysSinceLastSale: number;
        count: number;
        recentSales: {
            date: string;
            amount: number;
            property: string;
            nights: number;
        }[]
    }[]>([])
    const [selectedPartner, setSelectedPartner] = useState<typeof partnerData[0] | null>(null)
    const [groupedUnits, setGroupedUnits] = useState<Record<string, GroupPerformance[]>>({})
    const [selectedGroup, setSelectedGroup] = useState<GroupPerformance | null>(null)

    // Calendar & Seasonality states
    const [periods, setPeriods] = useState<PricingPeriod[]>([])
    const [seasonalities, setSeasonalities] = useState<any[]>([])

    // Load Period and Seasonalities data
    useEffect(() => {
        const loadPeriods = async () => {
            try {
                const res = await fetch("/api/pricing/periods")
                const result = await res.json()
                if (result.success && result.data?.length > 0) {
                    const dbPeriods = (result.data || []).map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        shortName: p.short_name,
                        startDate: p.start_date,
                        endDate: p.end_date,
                        type: p.type,
                        expectedNights: p.expected_nights,
                        sortOrder: p.sort_order,
                    }))
                    setPeriods(dbPeriods.sort((a: PricingPeriod, b: PricingPeriod) => a.startDate.localeCompare(b.startDate)))
                }
            } catch (e) {
                console.error("Erro periods", e)
            }
        }
        const loadSeasonalities = async () => {
            try {
                const res = await fetch("/api/pricing/seasonalities")
                const result = await res.json()
                if (result.success && result.data) {
                    setSeasonalities(result.data.map((s: any) => ({
                        id: s.id,
                        name: s.name,
                        pracas: (s.seasonality_pracas || []).map((sp: any) => sp.praca),
                        periods: (s.seasonality_periods || []).map((sp: any) => ({
                            periodId: sp.period_id,
                            percent: Number(sp.percent),
                        })),
                    })))
                }
            } catch (e) { }
        }
        loadPeriods()
        loadSeasonalities()
    }, [])

    const pracaSeasonalityMap = useMemo(() => {
        const map = new Map<string, any>()
        for (const s of seasonalities) {
            for (const p of s.pracas) {
                map.set(p, s)
            }
        }
        return map
    }, [seasonalities])

    // Load pricing intelligence data via SWR (cached + deduped)
    const { data: pricingResponse, isLoading: pricingLoading } = useSWR(
        '/api/pricing-intelligence',
        (url: string) => fetch(url).then(r => r.json()),
        {
            revalidateOnFocus: false,
            dedupingInterval: 300000, // 5 min dedup
            keepPreviousData: true,
        }
    )
    const pricingData = pricingResponse?.success ? pricingResponse.data : []

    useEffect(() => {
        if (!filteredData || filteredData.length === 0) return
        // Gate: wait until pricingData has loaded to avoid double-render
        // (fallback path renders first, then gets overwritten by pricingData path)
        if (pricingLoading) return

        const data = filteredData
        const hoje = new Date()
        const todayStr = hoje.toISOString().split('T')[0]
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
        const startOfMonthStr = inicioMes.toISOString().split('T')[0]

        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
        const fimMesStr = fimMes.toISOString().split('T')[0]
        const diasNoMes = fimMes.getDate()
        const diaAtual = hoje.getDate()
        const diasRestantes = diasNoMes - diaAtual
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        // Helper para calcular a MODA
        const calculateMode = (arr: number[]) => {
            if (arr.length === 0) return 0;
            const frequency: Record<number, number> = {};
            let maxFreq = 0;
            let mode = arr[0];

            for (const item of arr) {
                frequency[item] = (frequency[item] || 0) + 1;
                if (frequency[item] > maxFreq) {
                    maxFreq = frequency[item];
                    mode = item;
                }
            }
            return mode;
        };

        // 1. Calculate Revenue (STRICTLY CREATION DATE)
        const revenueMTD = data.reduce((total, item) => {
            const vendas = item.reservas
                .filter((r) => r.creationdate >= startOfMonthStr && r.creationdate <= todayStr)
                .reduce((sum, r) => sum + r.reservetotal, 0)
            return total + vendas
        }, 0)

        const revenueToday = data.reduce((total, item) => {
            const vendas = item.reservas
                .filter((r) => r.creationdate === todayStr)
                .reduce((sum, r) => sum + r.reservetotal, 0)
            return total + vendas
        }, 0)

        const revenueTarget = data.reduce((total, item) => total + (item.salesGoals?.mvenda_mensal || 0), 0)
        const percentOfTarget = revenueTarget > 0 ? (revenueMTD / revenueTarget) * 100 : 0
        const remainingTarget = Math.max(0, revenueTarget - revenueMTD)
        const dailyPaceRequired = diasRestantes > 0 ? remainingTarget / diasRestantes : 0
        const percentOfDailyPace = dailyPaceRequired > 0 ? (revenueToday / dailyPaceRequired) * 100 : 100

        // 2. Partner Performance Breakdown with Advanced Metrics
        const partnersMap = new Map<string, {
            total: number;
            count: number;
            lastSaleDate: Date | null;
            sales: any[];
        }>()

        data.forEach(item => {
            item.reservas.forEach(r => {
                if (r.creationdate >= startOfMonthStr && r.creationdate <= todayStr) {
                    const current = partnersMap.get(r.partnername) || {
                        total: 0,
                        count: 0,
                        lastSaleDate: null,
                        sales: []
                    }

                    const saleDate = new Date(r.creationdate)

                    partnersMap.set(r.partnername, {
                        total: current.total + r.reservetotal,
                        count: current.count + 1,
                        lastSaleDate: current.lastSaleDate ? (saleDate > current.lastSaleDate ? saleDate : current.lastSaleDate) : saleDate,
                        sales: [...current.sales, { ...r, propertyName: item.propriedade.nomepropriedade }]
                    })
                }
            })
        })

        const partnerArray = Array.from(partnersMap.entries())
            .map(([name, data]) => {
                const daysSinceLastSale = data.lastSaleDate
                    ? Math.floor((new Date().getTime() - data.lastSaleDate.getTime()) / (1000 * 60 * 60 * 24))
                    : 999

                // Sort sales by date desc
                const recentSales = data.sales
                    .sort((a, b) => new Date(b.creationdate).getTime() - new Date(a.creationdate).getTime())
                    .slice(0, 10)
                    .map(s => ({
                        date: s.creationdate,
                        amount: s.reservetotal,
                        property: s.propertyName,
                        nights: s.num_nights || 0 // Assuming num_nights exists or 0
                    }))

                return {
                    name,
                    value: data.total,
                    daysSinceLastSale,
                    count: data.count,
                    recentSales
                }
            })
            .sort((a, b) => b.value - a.value)

        setPartnerData(partnerArray)

        // 3. Tempo RAC (Lead Time) & Ticket Médio
        // Ticket Médio continua MTD para consistência com Revenue
        const reservasMTD = data.flatMap(item =>
            item.reservas.filter(r => r.creationdate >= startOfMonthStr && r.creationdate <= todayStr)
        )
        const totalReservasCountMTD = reservasMTD.length

        // Tempo RAC: Usar Janela de 30 dias para evitar problemas no dia 01
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

        const reservasLast30Days = data.flatMap(item =>
            item.reservas.filter(r => r.creationdate >= thirtyDaysAgoStr && r.creationdate <= todayStr)
        )

        const leadTimes30d = reservasLast30Days
            .filter(r => r.buyprice > 100) // Filter for data accuracy
            .map(r => r.antecedencia_reserva)
            .filter(v => v !== null && v !== undefined);
        const racTimeMode = calculateAverageExcludingOutliers(leadTimes30d);

        // 3.1. Aggregated Tempo RAC by Typology (Operação - Praça - Quartos)
        const typologyRacMap = new Map<string, number[]>();

        data.forEach(item => {
            const prop = item.propriedade;
            const typologyKey = `${prop.empreendimento_pousada}-${prop.praca}-${prop._i_rooms}`;

            const itemLeadTimes30d = item.reservas
                .filter(r => r.creationdate >= thirtyDaysAgoStr && r.creationdate <= todayStr && r.buyprice > 100) // Filter for data accuracy
                .map(r => r.antecedencia_reserva)
                .filter(v => v !== null && v !== undefined);

            if (itemLeadTimes30d.length > 0) {
                const existing = typologyRacMap.get(typologyKey) || [];
                typologyRacMap.set(typologyKey, [...existing, ...itemLeadTimes30d]);
            }
        });

        // Pre-calculate Mode for each typology
        const typologyModeMap = new Map<string, number>();
        typologyRacMap.forEach((leadTimes, key) => {
            typologyModeMap.set(key, calculateAverageExcludingOutliers(leadTimes));
        });

        const averageTicket = totalReservasCountMTD > 0 ? revenueMTD / totalReservasCountMTD : 0

        // 4. Process Units using Pricing Intelligence Data
        const unitsData: SalesUnitPerformance[] = data.map((item) => {
            // Find pricing intelligence data for this unit
            const pricingInfo = pricingData.find((p: any) => p.IdPropriedade === item.propriedade.idpropriedade)

            // Get aggregated RAC Mode from Typology
            const prop = item.propriedade;
            const typologyKey = `${prop.empreendimento_pousada}-${prop.praca}-${prop._i_rooms}`;
            const aggregatedRacMode = typologyModeMap.get(typologyKey) || 0; // Default to 0 if no data for typology

            if (pricingInfo) {
                // Use data directly from SQL query, but revenue from LOCAL data
                // to stay consistent with dialogMetrics (calendar view)
                const lastSale = item.reservas
                    .filter((r) => new Date(r.creationdate) <= hoje)
                    .sort((a, b) => new Date(b.creationdate).getTime() - new Date(a.creationdate).getTime())[0]

                const daysSinceLastSale = pricingInfo.dias_sem_venda ?? (lastSale
                    ? Math.floor((hoje.getTime() - new Date(lastSale.creationdate).getTime()) / (1000 * 60 * 60 * 24))
                    : 999)

                // Target Period logic
                const bqLeadTime = pricingInfo.lead_time_momento ?? aggregatedRacMode
                const tTargetDate = new Date(hoje)
                tTargetDate.setDate(hoje.getDate() + bqLeadTime)
                const tYear = pricingInfo.ano_alvo || tTargetDate.getFullYear()
                const tMonth = pricingInfo.mes_alvo || (tTargetDate.getMonth() + 1)

                let targetPeriodId = ""

                // Match period to BQ's mes_alvo/ano_alvo (always prioritize the month period)
                if (periods.length > 0) {
                    const targetMonthStr = `${tYear}-${String(tMonth).padStart(2, '0')}`
                    const monthMatch = periods.find(p => p.type === "month" && p.startDate.startsWith(targetMonthStr))
                    if (monthMatch) {
                        targetPeriodId = monthMatch.id
                    } else {
                        // Fallback: find any month period that contains the target date
                        const targetDateStr = tTargetDate.toISOString().split("T")[0]
                        const anyMonth = periods.find(p => p.type === "month" && targetDateStr >= p.startDate && targetDateStr <= p.endDate)
                        if (anyMonth) targetPeriodId = anyMonth.id
                    }
                }

                const tDaysInMonth = new Date(tYear, tMonth, 0).getDate()  // mes_alvo is 1-based, so (year, month, 0) gives last day
                const tMonthStart = `${tYear}-${String(tMonth).padStart(2, '0')}-01`
                const tMonthEnd = `${tYear}-${String(tMonth).padStart(2, '0')}-${String(tDaysInMonth).padStart(2, '0')}`
                const tCalendarYearMonth = `${tYear}-${String(tMonth).padStart(2, '0')}`

                // Pro-rata revenue: only count nights that fall within the target month
                // This matches the dialogMetrics calculation to avoid gap discrepancies

                // First isolate events from this target month to abate its nights
                const targetMonthEventDays = new Set<string>()
                const praca = item.propriedade.praca || 'Outros'
                const rawSeas = pracaSeasonalityMap.get(praca)
                if (rawSeas) {
                    const seasonEvents = periods.filter(p => p.type === 'event' && rawSeas.periods.some((sp: any) => sp.periodId === p.id))
                    for (const e of seasonEvents) {
                        let c = new Date(e.startDate)
                        const eD = new Date(e.endDate)
                        while (c <= eD) {
                            targetMonthEventDays.add(c.toISOString().split('T')[0])
                            c.setDate(c.getDate() + 1)
                        }
                    }
                }

                let localRevenue = 0
                const countedResKeys = new Set<string>()

                for (const r of item.reservas) {
                    if (!r.checkindate || !r.checkoutdate) continue
                    if (r.checkoutdate < tMonthStart || r.checkindate > tMonthEnd) continue

                    const resKey = `${r.checkindate}-${r.checkoutdate}-${r.reservetotal}`
                    if (countedResKeys.has(resKey)) continue

                    const nightCount = r.nightcount || Math.max(1, Math.round(
                        (new Date(r.checkoutdate + 'T12:00:00Z').getTime() - new Date(r.checkindate + 'T12:00:00Z').getTime()) / (1000 * 60 * 60 * 24)
                    ))

                    if (nightCount > 0) {
                        let nightsInPeriod = 0
                        const currentDt = new Date(r.checkindate + 'T12:00:00Z')
                        const endDt = new Date(r.checkoutdate + 'T12:00:00Z')
                        while (currentDt < endDt) {
                            const dtStr = currentDt.toISOString().split('T')[0]
                            if (dtStr.startsWith(tCalendarYearMonth) && !targetMonthEventDays.has(dtStr)) {
                                nightsInPeriod++
                            }
                            currentDt.setDate(currentDt.getDate() + 1)
                        }
                        if (nightsInPeriod > 0) {
                            localRevenue += (r.reservetotal / nightCount) * nightsInPeriod
                        }
                        countedResKeys.add(resKey)
                    }
                }

                // localRevenue now represents the revenue for non-event days in the target month.
                // It should perfectly match dialogMetrics revenue.
                // However, BQ pricingInfo metadata already comes with `realizado_mes` 
                // Let's rely entirely on localRevenue to make sure List View 100% matches Dialog Modal.

                let applicableTarget = pricingInfo.meta_mes
                const targetMonthPeriod = periods.find(p => p.type === 'month' && p.startDate.startsWith(tCalendarYearMonth))
                if (targetMonthPeriod && rawSeas) {
                    const monthSeasPercent = rawSeas.periods.find((sp: any) => sp.periodId === targetMonthPeriod.id)?.percent
                    if (monthSeasPercent !== undefined) {
                        applicableTarget = applicableTarget * (monthSeasPercent / 100)
                    }
                }

                const gapFaturamento = Math.max(0, applicableTarget - localRevenue)

                const percentAchieved = applicableTarget > 0
                    ? (localRevenue / applicableTarget) * 100
                    : 0

                const expectedPercent = (diaAtual / diasNoMes) * 100
                let status: "on-track" | "at-risk" | "behind" = "on-track"
                if (percentAchieved < expectedPercent * 0.7) status = "behind"
                else if (percentAchieved < expectedPercent * 0.9) status = "at-risk"

                // Calculate active storefront price (considering discounts)
                const targetDateStr = tTargetDate.toISOString().split("T")[0]
                const rawBasePrice = item.tarifario?.find(t => targetDateStr >= t.from && targetDateStr <= t.to)?.baserate || pricingInfo.preco_vitrine_hoje || 0
                const targetDiscountObj = item.discounts?.find(d => d.date === targetDateStr)
                let calculatedCurrentPrice = rawBasePrice
                if (targetDiscountObj && targetDiscountObj.discount_percent > 0) {
                    if (targetDiscountObj.is_rise) {
                        calculatedCurrentPrice = rawBasePrice * (1 + (targetDiscountObj.discount_percent / 100))
                    } else {
                        calculatedCurrentPrice = rawBasePrice * (1 - (targetDiscountObj.discount_percent / 100))
                    }
                }

                return {
                    id: item.propriedade.idpropriedade,
                    name: item.propriedade.nomepropriedade,
                    revenue: localRevenue,
                    target: applicableTarget,
                    percentAchieved,
                    daysSinceLastSale,
                    salesLast7Days: item.reservas.filter((r) => r.creationdate >= sevenDaysAgo.toISOString().split('T')[0]).length,
                    status,
                    suggestedAction: pricingInfo.acao_sugerida,
                    suggestedPrice: pricingInfo.preco_sugerido,
                    currentPrice: calculatedCurrentPrice,
                    leadTime: pricingInfo.lead_time_momento ?? aggregatedRacMode,
                    mesAlvo: pricingInfo.mes_alvo,
                    anoAlvo: pricingInfo.ano_alvo,
                    targetPeriodId, // added field

                    nightsSoldMonth: pricingInfo.noites_vendidas,
                    availableNightsMonth: pricingInfo.noites_livres,
                    noitesParaVendaEfetiva: pricingInfo.noites_para_venda_efetiva,
                    reservations: item.reservas,
                    occupancy: item.ocupacao || []
                }
            }

            // Fallback: use old logic if pricing data not available
            const target = item.salesGoals?.mvenda_mensal || 0
            const fallbackCalendarYearMonth = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
            let unitRevenue = 0
            const fallbackCountedKeys = new Set<string>()
            for (const r of item.reservas) {
                if (!r.checkindate || !r.checkoutdate) continue
                if (r.checkoutdate < startOfMonthStr || r.checkindate > fimMesStr) continue

                const resKey = `${r.checkindate}-${r.checkoutdate}-${r.reservetotal}`
                if (fallbackCountedKeys.has(resKey)) continue

                const nightCount = r.nightcount || Math.max(1, Math.round(
                    (new Date(r.checkoutdate + 'T12:00:00Z').getTime() - new Date(r.checkindate + 'T12:00:00Z').getTime()) / (1000 * 60 * 60 * 24)
                ))

                if (nightCount > 0) {
                    let nightsInPeriod = 0
                    const currentDt = new Date(r.checkindate + 'T12:00:00Z')
                    const endDt = new Date(r.checkoutdate + 'T12:00:00Z')
                    while (currentDt < endDt) {
                        const dtStr = currentDt.toISOString().split('T')[0]
                        if (dtStr.startsWith(fallbackCalendarYearMonth)) {
                            nightsInPeriod++
                        }
                        currentDt.setDate(currentDt.getDate() + 1)
                    }
                    unitRevenue += (r.reservetotal / nightCount) * nightsInPeriod
                }
                fallbackCountedKeys.add(resKey)
            }

            const percentAchieved = target > 0 ? (unitRevenue / target) * 100 : 0
            const expectedPercent = (diaAtual / diasNoMes) * 100

            let status: "on-track" | "at-risk" | "behind" = "on-track"
            if (percentAchieved < expectedPercent * 0.7) status = "behind"
            else if (percentAchieved < expectedPercent * 0.9) status = "at-risk"

            const lastSale = item.reservas
                .filter((r) => new Date(r.creationdate) <= hoje)
                .sort((a, b) => new Date(b.creationdate).getTime() - new Date(a.creationdate).getTime())[0]

            const daysSinceLastSale = lastSale
                ? Math.floor((hoje.getTime() - new Date(lastSale.creationdate).getTime()) / (1000 * 60 * 60 * 24))
                : 999

            const gap = Math.max(0, target - unitRevenue)
            const noitesVendidas = item.metricas.diariasVendidas || 0
            const noitesLivresTotal = Math.max(0, 30 - noitesVendidas)
            const noitesParaVendaEfetiva = Math.min(noitesLivresTotal, Math.max(0, 18 - noitesVendidas))
            const precoMinAbsoluto = target / 20

            const suggestedPrice = noitesParaVendaEfetiva > 0
                ? Math.max(gap / noitesParaVendaEfetiva, precoMinAbsoluto)
                : precoMinAbsoluto

            let suggestedAction = "META ATINGIDA"
            if (gap <= 0) suggestedAction = "META ATINGIDA"
            else if (noitesVendidas >= 18) suggestedAction = "TETO 18 NOITES - MANTER ADR"
            else if (noitesParaVendaEfetiva === 0) suggestedAction = "META INATINGÍVEL"
            else if ((gap / noitesParaVendaEfetiva) < precoMinAbsoluto) suggestedAction = "PISO MÍNIMO (DIV 20)"
            else suggestedAction = "ATUAR NO PREÇO SUGERIDO"

            let fallbackTargetPeriodId = ""
            if (periods.length > 0) fallbackTargetPeriodId = periods[0].id

            return {
                id: item.propriedade.idpropriedade,
                name: item.propriedade.nomepropriedade,
                revenue: unitRevenue,
                target,
                percentAchieved,
                daysSinceLastSale,
                salesLast7Days: item.reservas.filter((r) => r.creationdate >= sevenDaysAgo.toISOString().split('T')[0]).length,
                status,
                suggestedAction,
                suggestedPrice,
                currentPrice: item.metricas.precoMedioNoite || 0,
                leadTime: aggregatedRacMode,
                targetPeriodId: fallbackTargetPeriodId,
                nightsSoldMonth: noitesVendidas,
                availableNightsMonth: noitesLivresTotal,
                noitesParaVendaEfetiva,
                reservations: item.reservas,
                occupancy: item.ocupacao
            }
        })

        // Sort by priority: Days since last sale ASC (Fewer days first)
        unitsData.sort((a, b) => a.daysSinceLastSale - b.daysSinceLastSale)

        setUnits(unitsData)

        // Group by Praça -> Grupo
        const groups: Record<string, Record<string, GroupPerformance>> = {}

        // Sort units by revenue desc before grouping to have order
        unitsData.sort((a, b) => b.revenue - a.revenue).forEach(unit => {
            // Get praca from the original property data
            const originalItem = data.find(d => d.propriedade.idpropriedade === unit.id);
            const pracaName = originalItem?.propriedade.praca || "Outros";
            const grupoName = originalItem?.propriedade.grupo_nome || "Sem Grupo";

            if (!groups[pracaName]) groups[pracaName] = {}
            if (!groups[pracaName][grupoName]) {
                groups[pracaName][grupoName] = {
                    name: grupoName,
                    praca: pracaName,
                    revenue: 0,
                    target: 0,
                    percentAchieved: 0,
                    unitCount: 0,
                    units: []
                }
            }

            const group = groups[pracaName][grupoName]
            group.revenue += unit.revenue
            group.target += unit.target
            group.unitCount += 1
            group.units.push(unit)
        })

        // Calculate percentages and convert to array
        const finalGroups: Record<string, GroupPerformance[]> = {}
        Object.entries(groups).forEach(([praca, gruposMap]) => {
            finalGroups[praca] = Object.values(gruposMap).map(g => ({
                ...g,
                percentAchieved: g.target > 0 ? (g.revenue / g.target) * 100 : 0
            })).sort((a, b) => b.revenue - a.revenue)
        })

        setGroupedUnits(finalGroups)

        // Metrics for cards
        setMetrics({
            revenueMTD,
            revenueTarget,
            percentOfTarget,
            revenueToday,
            percentOfDailyPace,
            dailyPaceRequired,
            unitsAtRisk: unitsData.filter(u => u.status !== "on-track").length,
            averageTicket,
            averageLeadTime: racTimeMode // Using existing field for "Tempo RAC"
        })

        // Chart Data (Creation Pace)
        const chartDataArray = []
        let accumulated = 0
        const dailyTarget = revenueTarget / diasNoMes

        for (let dia = 1; dia <= diasNoMes; dia++) {
            if (dia <= diaAtual) {
                const dataStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
                const vendaDia = data.reduce((total, item) => {
                    return total + item.reservas
                        .filter((r) => r.creationdate === dataStr)
                        .reduce((sum, r) => sum + r.reservetotal, 0)
                }, 0)
                accumulated += vendaDia
                chartDataArray.push({ dia, realizado: accumulated, meta: dailyTarget * dia })
            } else {
                chartDataArray.push({ dia, realizado: null, meta: dailyTarget * dia })
            }
        }
        setChartData(chartDataArray)
    }, [filteredData, pricingData, dashboardLoading, pricingLoading])

    // Basket calculation moved to CompetitorAnalysisCard component.

    // Recalculate dialog metrics from LOCAL reservation/occupancy data
    // UNIFIED: Derives the target month from the SAME period the calendar shows
    // (based on targetPeriodId), so all indicators match the calendar view.
    const dialogMetrics = useMemo(() => {
        if (!selectedUnit) return null

        // 1. Determine the target month - PRIMARY: BQ's mesAlvo/anoAlvo (same as list view gap)
        //    This ensures Gap inside modal MATCHES the Gap in the list view.
        let year: number, monthOneBased: number

        if ((selectedUnit as any).mesAlvo && (selectedUnit as any).anoAlvo) {
            // Use BigQuery's target month (lead time-derived) — same as what the list uses
            monthOneBased = (selectedUnit as any).mesAlvo
            year = (selectedUnit as any).anoAlvo
        } else {
            // Fallback: compute from leadTime
            const today = new Date()
            const targetDate = new Date()
            targetDate.setDate(today.getDate() + (selectedUnit.leadTime ?? 0))
            year = targetDate.getFullYear()
            monthOneBased = targetDate.getMonth() + 1
        }

        const daysInMonth = new Date(year, monthOneBased, 0).getDate()

        // Month boundaries (YYYY-MM-DD)
        const monthStart = `${year}-${String(monthOneBased).padStart(2, '0')}-01`
        const monthEnd = `${year}-${String(monthOneBased).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

        // Identify event days to exclude (same logic as availability-calendar.tsx)
        const rawUnit = rawData.find(d => d.propriedade.idpropriedade === selectedUnit.id)
        const praca = rawUnit?.propriedade.praca || 'Outros'
        const savedSeas = pracaSeasonalityMap.get(praca)
        const eventDaysSet = new Set<string>()

        if (savedSeas) {
            const eventsInSeasonality = periods.filter(p => {
                if (p.type !== 'event') return false
                if (!savedSeas.periods.some((sp: any) => sp.periodId === p.id)) return false
                const pStartDt = new Date(p.startDate)
                const pEndDt = new Date(p.endDate)
                const mStartDt = new Date(year, monthOneBased - 1, 1)
                const mEndDt = new Date(year, monthOneBased, 0)
                return pStartDt <= mEndDt && pEndDt >= mStartDt
            })
            for (const e of eventsInSeasonality) {
                let current = new Date(e.startDate)
                const end = new Date(e.endDate)
                while (current <= end) {
                    eventDaysSet.add(current.toISOString().split('T')[0])
                    current.setDate(current.getDate() + 1)
                }
            }
        }

        // Count occupied nights from occupancy + reservations (same logic as calendar)
        let nightsSold = 0
        let nightsFree = 0
        const dayReservationMap: Record<string, { partnername: string; checkindate: string; checkoutdate: string; reservetotal: number; num_nights?: number }> = {}

        for (let d = 1; d <= daysInMonth; d++) {
            const dayStr = `${year}-${String(monthOneBased).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            if (eventDaysSet.has(dayStr)) continue // Exclui eventos da métrica

            const occData = selectedUnit.occupancy?.find((o: any) => o.datas === dayStr)
            const isGuestSale = occData?.ocupado === 1 && occData?.ocupado_proprietario === 0 && occData?.manutencao === 0
            const isOwner = occData?.ocupado_proprietario === 1
            const isMaintenance = occData?.manutencao === 1

            const matchingReservation = !occData
                ? selectedUnit.reservations?.find((r: any) => dayStr >= r.checkindate && dayStr < r.checkoutdate)
                : null
            const isReservedInResList = !!matchingReservation

            if (isGuestSale || isReservedInResList) {
                nightsSold++
                const res = matchingReservation || selectedUnit.reservations?.find((r: any) => dayStr >= r.checkindate && dayStr < r.checkoutdate)
                if (res) dayReservationMap[dayStr] = res
            } else if (!isOwner && !isMaintenance) {
                nightsFree++
            }
        }

        // Revenue: sum pro-rata of reservations whose stay overlaps the target month
        let revenue = 0
        const countedReservations = new Set<string>()
        for (let d = 1; d <= daysInMonth; d++) {
            const dayStr = `${year}-${String(monthOneBased).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            if (eventDaysSet.has(dayStr)) continue // Exclui receita que caiu em dias de evento

            const res = selectedUnit.reservations?.find((r: any) => dayStr >= r.checkindate && dayStr < r.checkoutdate)
            if (!res) continue

            const resKey = `${res.checkindate}-${res.checkoutdate}-${res.reservetotal}`
            if (countedReservations.has(resKey)) {
                // Already counted pro-rata for this reservation
                continue
            }

            // Pro-rata: count only nights of this reservation that fall in the month (excluding events)
            if (res.nightcount > 0) {
                let nightsInPeriod = 0
                let currentDt = new Date(res.checkindate + 'T12:00:00Z')
                const endDt = new Date((res.checkoutdate || res.checkindate) + 'T12:00:00Z')
                const calendarYearMonth = `${year}-${String(monthOneBased).padStart(2, '0')}`

                while (currentDt < endDt) {
                    const dtStr = currentDt.toISOString().split('T')[0]
                    if (dtStr.startsWith(calendarYearMonth) && !eventDaysSet.has(dtStr)) {
                        nightsInPeriod++
                    }
                    currentDt.setDate(currentDt.getDate() + 1)
                }

                const proRata = res.reservetotal / res.nightcount
                revenue += nightsInPeriod * proRata
            }
            countedReservations.add(resKey)
        }

        const rawTarget = selectedUnit.target || 0
        let applicableTarget = rawTarget
        let expectedSaleNights = 18 // Default fallback

        // Identify the exact month period mapped in Supabase to get its 'expectedNights'
        // and its target share % (e.g., 20% if 80% of revenue is projected for holidays)
        const targetMonthPrefix = `${year}-${String(monthOneBased).padStart(2, '0')}`
        const targetMonthPeriod = periods.find(p => p.type === 'month' && p.startDate.startsWith(targetMonthPrefix))

        if (targetMonthPeriod) {
            if (targetMonthPeriod.expectedNights !== undefined && targetMonthPeriod.expectedNights !== null) {
                expectedSaleNights = targetMonthPeriod.expectedNights
            }

            if (savedSeas) {
                const monthSeasPercent = savedSeas.periods.find((sp: any) => sp.periodId === targetMonthPeriod.id)?.percent
                if (monthSeasPercent !== undefined) {
                    applicableTarget = rawTarget * (monthSeasPercent / 100)
                }
            }
        }

        const percentAchieved = applicableTarget > 0 ? (revenue / applicableTarget) * 100 : 0
        const gap = applicableTarget - revenue
        const nightsForEffectiveSale = Math.min(nightsFree, Math.max(0, expectedSaleNights - nightsSold))

        // Build month label
        const monthDate = new Date(year, monthOneBased - 1, 1)

        return {
            nightsSold,
            nightsFree,
            nightsForEffectiveSale,
            revenue,
            percentAchieved,
            gap,
            targetDisplay: applicableTarget,
            monthStart,
            monthEnd,
            year,
            monthOneBased,
            daysInMonth,
            monthLabel: monthDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }),
            dayReservationMap,
        }
    }, [selectedUnit, periods, rawData, pracaSeasonalityMap])

    // Show nice loading screen on first load
    if (isFirstLoad) {
        return <InitialLoadingScreen />
    }

    // Show skeleton if still loading data
    if ((dashboardLoading || pricingLoading) && rawData.length === 0) {
        return <VendasSkeleton />
    }

    return (
        <div className="space-y-6">
            {/* Global Filters */}
            <FilterBar filterOptions={filterOptions} />

            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <ShoppingBag className="h-8 w-8 text-primary" />
                    <h1 className="text-3xl font-bold tracking-tight">Gestão de Vendas</h1>
                </div>
                <p className="text-muted-foreground italic">Foco único em performance de criação, canais e estratégia de precificação baseada em tempo RAC.</p>
            </div>

            {/* KPI Cards Consolidados */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Card className="border-l-4 border-l-primary">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Vendas MTD (Criação)</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            R$ {metrics.revenueMTD.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <Progress value={metrics.percentOfTarget} className="h-1.5 flex-1" />
                            <span className="text-xs font-bold">{metrics.percentOfTarget.toFixed(0)}%</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">Meta: R$ {metrics.revenueTarget.toLocaleString("pt-BR")}</p>
                    </CardContent>
                </Card>

                <Card className={metrics.percentOfDailyPace >= 100 ? "border-l-4 border-l-success" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Venda Hoje</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            R$ {metrics.revenueToday.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <Progress
                                value={Math.min(100, metrics.percentOfDailyPace)}
                                className={`h-1.5 flex-1 ${metrics.percentOfDailyPace >= 100 ? "bg-success/20" : ""}`}
                            />
                            <span className="text-[10px] font-bold">{metrics.percentOfDailyPace.toFixed(0)}%</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">
                            Meta Diária: R$ {metrics.dailyPaceRequired.toLocaleString("pt-BR")}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Ticket Médio (MTD)</CardTitle>
                        <DollarSign className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {metrics.averageTicket.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</div>
                        <p className="text-xs text-muted-foreground mt-1">Média por reserva no mês</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Tempo RAC (Moda 30d)</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.averageLeadTime.toFixed(0)} dias</div>
                        <p className="text-xs text-muted-foreground mt-1">Moda de antecedência (últimos 30 dias)</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Controle de Ritmo Chart */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Sales Pace (Ritmo de Venda)</CardTitle>
                        <CardDescription>Acompanhamento de vendas acumuladas por data de criação vs meta linear</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="dia" className="text-[10px]" />
                                    <YAxis className="text-[10px]" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                                    <RechartsTooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        formatter={(v: any) => [`R$ ${v?.toLocaleString("pt-BR")}`, ""]}
                                    />
                                    <Area type="monotone" dataKey="realizado" fill="var(--chart-1)" fillOpacity={0.1} stroke="var(--chart-1)" strokeWidth={3} name="Realizado" />
                                    <Line type="monotone" dataKey="meta" stroke="var(--chart-3)" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Meta" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="mt-6 pt-4 border-t">
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-4 flex items-center gap-2">
                                <Target className="h-3 w-3" />
                                Maiores Gaps de Meta
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {units
                                    .filter(u => u.target > 0 && u.revenue < u.target)
                                    .map(u => ({ ...u, gap: u.target - u.revenue }))
                                    .sort((a, b) => b.gap - a.gap)
                                    .slice(0, 6)
                                    .map((unit) => (
                                        <div
                                            key={unit.id}
                                            className="flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 rounded-lg border border-transparent hover:border-border transition-all cursor-pointer group"
                                            onClick={() => setSelectedUnit(unit)}
                                        >
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-medium text-sm truncate max-w-[140px]" title={unit.name}>
                                                    {unit.name}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal bg-background">
                                                        {unit.percentAchieved.toFixed(0)}%
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        de R$ {(unit.target / 1000).toFixed(1)}k
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-bold text-destructive">
                                                    -R$ {unit.gap.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                                                    Ver detalhes &rarr;
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                {units.filter(u => u.target > 0 && u.revenue < u.target).length === 0 && (
                                    <div className="col-span-full text-center py-4 text-muted-foreground text-sm">
                                        Todas as unidades atingiram a meta! 🎉
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Group Layout Breakdown */}
                        <div className="mt-8 space-y-8 max-h-[600px] overflow-y-auto pr-2">
                            {Object.entries(groupedUnits).map(([praca, groups]) => (
                                <div key={praca}>
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 pl-1 border-l-4 border-primary/50">
                                        {praca}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {groups.map((group) => (
                                            <div
                                                key={group.name}
                                                className="flex flex-col p-4 bg-card hover:bg-muted/30 rounded-xl border transition-all cursor-pointer group hover:shadow-md"
                                                onClick={() => setSelectedGroup(group)}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h5 className="font-semibold text-sm">{group.name}</h5>
                                                        <p className="text-[10px] text-muted-foreground">{group.unitCount} unidades</p>
                                                    </div>
                                                    <Badge variant={group.percentAchieved >= 100 ? "default" : "secondary"} className={group.percentAchieved >= 100 ? "bg-success hover:bg-success/90" : ""}>
                                                        {group.percentAchieved.toFixed(0)}%
                                                    </Badge>
                                                </div>

                                                <div className="space-y-1 mt-2">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-muted-foreground">Meta:</span>
                                                        <span className="font-mono">{(group.target / 1000).toFixed(1)}k</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-muted-foreground">Realizado:</span>
                                                        <span className="font-mono font-medium">{(group.revenue / 1000).toFixed(1)}k</span>
                                                    </div>
                                                    <Progress value={Math.min(100, group.percentAchieved)} className={`h-1.5 mt-2 ${group.percentAchieved >= 100 ? "bg-success/20" : ""}`} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Partner Performance List */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle>Ranking de Canais</CardTitle>
                        <CardDescription>Performance de vendas MTD por canal</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                        <div className="space-y-4">
                            {partnerData.map((partner, index) => {
                                const maxVal = Math.max(...partnerData.map(p => p.value));
                                const percent = (partner.value / maxVal) * 100;

                                return (
                                    <div
                                        key={index}
                                        className="group cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-all"
                                        onClick={() => setSelectedPartner(partner)}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm flex items-center gap-2">
                                                    {index + 1}. {partner.name}
                                                    {index === 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1">Líder</Badge>}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {partner.daysSinceLastSale === 0 ? "Vendeu hoje" :
                                                        partner.daysSinceLastSale === 1 ? "Última venda ontem" :
                                                            `${partner.daysSinceLastSale} dias sem vender`}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-sm">R$ {partner.value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</div>
                                                <div className="text-[10px] text-muted-foreground">{partner.count} reservas</div>
                                            </div>
                                        </div>
                                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${percent}%`,
                                                    backgroundColor: CHART_COLORS[index % CHART_COLORS.length]
                                                }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                            {partnerData.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground text-sm">Nenhum dado de canal disponível</div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Dialog open={!!selectedPartner} onOpenChange={(open) => !open && setSelectedPartner(null)}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                {selectedPartner?.name}
                                <Badge variant="outline">Histórico Recente</Badge>
                            </DialogTitle>
                            <DialogDescription>
                                Últimas {selectedPartner?.recentSales.length} vendas realizadas neste canal.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-muted/30 rounded-lg border text-center">
                                    <p className="text-xs text-muted-foreground uppercase">Total MTD</p>
                                    <p className="text-xl font-bold text-primary">R$ {selectedPartner?.value.toLocaleString("pt-BR")}</p>
                                </div>
                                <div className="p-3 bg-muted/30 rounded-lg border text-center">
                                    <p className="text-xs text-muted-foreground uppercase">Dias s/ Venda</p>
                                    <p className={`text-xl font-bold ${(selectedPartner?.daysSinceLastSale ?? 0) > 3 ? 'text-orange-500' : 'text-green-600'}`}>
                                        {selectedPartner?.daysSinceLastSale}
                                    </p>
                                </div>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="text-xs h-8">Data</TableHead>
                                            <TableHead className="text-xs h-8">Propriedade</TableHead>
                                            <TableHead className="text-xs h-8 text-right">Valor</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedPartner?.recentSales.map((sale, idx) => (
                                            <TableRow key={idx} className="hover:bg-muted/5">
                                                <TableCell className="text-xs py-2">
                                                    {new Date(sale.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                </TableCell>
                                                <TableCell className="text-xs py-2 max-w-[150px] truncate" title={sale.property}>
                                                    {sale.property}
                                                </TableCell>
                                                <TableCell className="text-xs py-2 text-right font-medium">
                                                    R$ {sale.amount.toLocaleString("pt-BR")}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog open={!!selectedGroup} onOpenChange={(open) => !open && setSelectedGroup(null)}>
                    <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-lg">
                                {selectedGroup?.name}
                                <Badge variant="outline">{selectedGroup?.praca}</Badge>
                            </DialogTitle>
                            <DialogDescription>
                                Detalhamento de performance por unidade do grupo.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="mt-4 overflow-x-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40%]">Unidade</TableHead>
                                        <TableHead className="text-right whitespace-nowrap">Venda</TableHead>
                                        <TableHead className="text-right whitespace-nowrap">%</TableHead>
                                        <TableHead className="text-right whitespace-nowrap">Falta</TableHead>
                                        <TableHead className="text-right w-[40px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedGroup?.units.map((unit) => {
                                        const gap = Math.max(0, unit.target - unit.revenue);
                                        return (
                                            <TableRow key={unit.id} className="cursor-pointer hover:bg-muted/50 h-10" onClick={() => {
                                                setSelectedGroup(null);
                                                setSelectedUnit(unit);
                                            }}>
                                                <TableCell className="font-medium p-2">
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                                        <span className="truncate max-w-[150px] sm:max-w-[200px]" title={unit.name}>{unit.name}</span>
                                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 bg-muted px-1 rounded">
                                                            {unit.daysSinceLastSale === 0 ? "Hoje" : `${unit.daysSinceLastSale}d atrás`}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right text-xs font-bold p-2 whitespace-nowrap">
                                                    R$ {(unit.revenue / 1000).toFixed(1)}k
                                                </TableCell>
                                                <TableCell className="text-right p-2">
                                                    <Badge variant={unit.percentAchieved >= 100 ? "default" : "outline"} className={`h-5 text-[10px] px-1 ${unit.percentAchieved >= 100 ? "bg-success hover:bg-success/90" : ""}`}>
                                                        {unit.percentAchieved.toFixed(0)}%
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-destructive font-medium p-2 whitespace-nowrap">
                                                    {gap > 0 ? `-R$ ${(gap / 1000).toFixed(1)}k` : "-"}
                                                </TableCell>
                                                <TableCell className="text-right p-2">
                                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-transparent">
                                                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* ACTION HUB (SQL LOGIC) */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Inteligência de Precificação e Ações</CardTitle>
                            <CardDescription>Sugestões baseadas no Gap de faturamento e teto estratégico de 18 noites</CardDescription>
                        </div>
                        <Badge variant="outline">Baseado em SQL de Vendas</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="max-h-[500px] overflow-y-auto -mx-4 sm:mx-0">
                        <div className="overflow-x-auto">
                            <Table className="min-w-[700px]">
                                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead>Unidade</TableHead>
                                        <TableHead className="text-right">Días s/ Venda</TableHead>
                                        <TableHead className="text-right">Gap Meta</TableHead>
                                        <TableHead className="text-right">Preço Sugerido</TableHead>
                                        <TableHead>Ação Sugerida</TableHead>
                                        <TableHead className="text-right">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {units.filter(u => u.daysSinceLastSale > 7).map((unit) => (
                                        <TableRow key={unit.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span>{unit.name}</span>
                                                    <span className="text-[10px] text-muted-foreground">RAC: {unit.leadTime.toFixed(0)}d</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant={unit.daysSinceLastSale > 10 ? "destructive" : "outline"}>
                                                    {unit.daysSinceLastSale}d
                                                </Badge>
                                            </TableCell>
                                            <TableCell className={`text-right font-bold ${(unit.target - unit.revenue) > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                                                {(unit.target - unit.revenue) <= 0 ? '+' : ''}R$ {Math.abs(unit.target - unit.revenue).toLocaleString("pt-BR")}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-success">
                                                R$ {(unit.suggestedPrice ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {(unit.suggestedAction ?? "").includes("ATUAR") ? <AlertCircle className="h-4 w-4 text-warning" /> : <TrendingUp className="h-4 w-4 text-primary" />}
                                                    <span className="text-xs font-semibold">{unit.suggestedAction ?? "N/A"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm" onClick={() => setSelectedUnit(unit)}>
                                                    Estratégia
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Intelligence Modal (NEW VERSION WITH THERMOMETER) */}
            <Dialog open={!!selectedUnit} onOpenChange={(open) => !open && setSelectedUnit(null)}>
                <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Target className="h-5 w-5 text-primary" />
                            Inteligência de Vendas: {selectedUnit?.name}
                        </DialogTitle>
                        <DialogDescription>
                            Explicação da estratégia sugerida e métricas de suporte.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedUnit && (
                        <div className="space-y-6 py-4 overflow-y-auto max-h-[80vh] pr-2">

                            {/* --- MARKET INTELLIGENCE SECTION --- */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* 1. COMPONENTIZED PRICING POSITIONING */}
                                <CompetitorAnalysisCard
                                    unitId={selectedUnit.id}
                                    unitName={selectedUnit.name}
                                    currentPrice={selectedUnit.currentPrice}
                                />

                                {/* GAP DE FATURAMENTO - recalculated from local data */}
                                <div className="space-y-4">
                                    <div className="p-4 bg-muted/40 rounded-xl border">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Gap de Faturamento</p>
                                        <div className="flex justify-between items-end">
                                            <p className={`text-2xl font-bold ${(dialogMetrics?.gap ?? 0) > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                                                {(dialogMetrics?.gap ?? 0) <= 0 ? '+' : ''}R$ {Math.abs(dialogMetrics?.gap ?? 0).toLocaleString("pt-BR")}
                                            </p>
                                            <Badge variant="outline" className="text-xs">
                                                {(dialogMetrics?.percentAchieved ?? 0).toFixed(0)}% da Meta
                                            </Badge>
                                        </div>
                                        <Progress value={Math.min(dialogMetrics?.percentAchieved ?? 0, 100)} className="h-1 mt-2" />
                                    </div>

                                    <div className="grid grid-cols-1 mt-3 gap-3">
                                        <div className="p-4 bg-muted/40 rounded-lg flex items-center justify-between">
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Lead Time de Mercado (Alvo)</p>
                                            <p className="text-xl font-bold text-slate-800">{(selectedUnit.leadTime ?? 0).toFixed(0)} dias</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                                <div className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Preço Vitrine Atual</p>
                                    <p className="text-lg font-bold text-blue-600">
                                        R$ {(selectedUnit.currentPrice ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <div className="p-3 bg-purple-500/5 rounded-lg border border-purple-500/10">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Variação Sugerida</p>
                                    <p className={`text-lg font-bold ${((selectedUnit.suggestedPrice ?? 0) - (selectedUnit.currentPrice ?? 0)) > 0
                                        ? 'text-success'
                                        : 'text-destructive'
                                        }`}>
                                        {((selectedUnit.currentPrice ?? 0) > 0
                                            ? (((selectedUnit.suggestedPrice ?? 0) - (selectedUnit.currentPrice ?? 0)) / (selectedUnit.currentPrice ?? 1) * 100).toFixed(1)
                                            : 0
                                        )}%
                                    </p>
                                </div>
                                <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                                    <div className="flex items-center gap-2 mb-1">
                                        <CheckCircle className="h-3 w-3 text-primary" />
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Noites Vendidas</p>
                                    </div>
                                    <p className="text-lg font-bold">{dialogMetrics?.nightsSold ?? 0} noites</p>
                                </div>
                                <div className="p-3 bg-orange-500/5 rounded-lg border border-orange-500/10">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Activity className="h-3 w-3 text-orange-500" />
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Venda Efetiva</p>
                                    </div>
                                    <p className="text-lg font-bold text-orange-600">{dialogMetrics?.nightsForEffectiveSale ?? 0} diárias</p>
                                </div>
                            </div>

                            {/* CALENDAR SECTION */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center border-b pb-1">
                                    <h4 className="text-sm font-semibold text-primary uppercase tracking-wider">
                                        Visão de Disponibilidade
                                    </h4>
                                    <Badge variant="outline" className="text-[10px]">
                                        {dialogMetrics?.monthLabel ?? ''}
                                    </Badge>
                                </div>

                                {/* NEW CALENDAR SECTION */}
                                <div className="space-y-3 px-1">
                                    {selectedUnit && rawData.find(d => d.propriedade.idpropriedade === selectedUnit.id) && periods.length > 0 ? (
                                        <AvailabilityCalendar
                                            unitId={selectedUnit.id}
                                            rawData={rawData}
                                            periods={periods}
                                            selectedPeriodId={
                                                (selectedUnit as any).targetPeriodId || periods.find(p => p.type === 'month' && p.endDate >= new Date().toISOString())?.id || periods[0].id
                                            }
                                            pracaSeasonalityMap={pracaSeasonalityMap}
                                        />
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic my-4 text-center">Carregando calendário...</p>
                                    )}
                                </div>
                                <p className="text-[10px] text-center text-muted-foreground italic">
                                    * Calendário focado na janela de compra (Lead Time de {(selectedUnit.leadTime ?? 0).toFixed(0)} dias).
                                </p>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold border-b pb-1 text-primary">Estratégia Recomendada</h4>
                                <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                                    <p className="text-xs font-bold text-primary uppercase mb-1">Ação:</p>
                                    <p className="text-sm font-semibold">{selectedUnit.suggestedAction ?? "N/A"}</p>
                                    <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                                        {(selectedUnit.suggestedAction ?? "") === "TETO 18 NOITES - MANTER ADR"
                                            ? "A unidade já atingiu o teto de ocupação estratégica. O foco agora é manter o preço alto para maximizar a receita das noites restantes."
                                            : "O preço sugerido de R$ " + (selectedUnit.suggestedPrice ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + " visa atrair reservas na janela de " + (selectedUnit.leadTime ?? 0).toFixed(0) + " dias, onde ainda há disponibilidade."}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-background pb-2">
                                <Button className="flex-1" asChild>
                                    <Link href="/pricing">Executar Mudança</Link>
                                </Button>
                                <Button variant="outline" onClick={() => setSelectedUnit(null)}>
                                    Fechar
                                </Button>
                            </div>
                        </div >
                    )
                    }
                </DialogContent >
            </Dialog >
        </div >
    )
}

function calculateAverageExcludingOutliers(numbers: number[]): number {
    if (numbers.length === 0) return 0;

    // 1. Sort the array
    const sorted = [...numbers].sort((a, b) => a - b);

    // 2. Calculate Q1 and Q3
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];

    // 3. Calculate IQR
    const iqr = q3 - q1;

    // 4. Define bounds
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    // 5. Filter outliers
    const filtered = sorted.filter(n => n >= lowerBound && n <= upperBound);

    // 6. Calculate Average
    if (filtered.length === 0) return 0;
    const sum = filtered.reduce((a, b) => a + b, 0);
    return sum / filtered.length;
}

function calculateMode(numbers: number[]): number {
    // Legacy function, kept if needed, but replaced by IQR Average
    if (numbers.length === 0) return 0;
    const counts: Record<number, number> = {};
    numbers.forEach((num) => {
        counts[num] = (counts[num] || 0) + 1;
    });

    let maxCount = 0;
    let mode = 0;
    for (const num in counts) {
        if (counts[num] > maxCount) {
            maxCount = counts[num];
            mode = Number(num);
        }
    }
    return mode;
}
