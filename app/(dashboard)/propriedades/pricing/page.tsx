"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  LineChart, Line, XAxis, YAxis,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, CartesianGrid, Cell, ReferenceLine
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Calendar, Target, TrendingUp, BarChart3, Settings, Star, Plus, Trash2, Save, Loader2, Pencil, Check, X, ChevronDown } from "lucide-react"
import { InitialLoadingScreen, PricingSkeleton } from "@/components/page-skeleton"
import { FilterBar } from "@/components/filters/filter-bar"
import { useGlobalFilters } from "@/contexts/global-filters-context"
import { applyGlobalFilters, getFilterOptions } from "@/lib/filter-utils"
import { useDashboardData } from "@/contexts/dashboard-provider"
import { CompetitorAnalysisCard } from "@/components/competitor-analysis-card"
import { AnalyticsCharts } from "@/components/analytics-charts"
import { AvailabilityCalendar, PricingPeriod } from "@/components/availability-calendar"

// ─── Types ───────────────────────────────────────────────────────────────────


interface Seasonality {
  id: string
  name: string
  pracas: string[]
  periods: { periodId: string; percent: number }[]
}

interface UnitPeriodPricing {
  unitId: string
  unitName: string
  praca: string
  grupo: string
  periodGoal: number // Meta do mês específico selecionado
  annualGoal: number
  expectedNights: number
  optimalPrice: number
  currentAvgPrice: number
  priceDelta: number
  projectedRevenue: number
  revenueShare: number
  seasonalityName: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateDDMM(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr
  const [, mm, dd] = dateStr.split("-")
  return `${dd}/${mm}`
}

// Normalize a date to a target year for period matching (e.g., "2025-05-15" → "2026-05-15")
function normalizeYearForPeriod(date: string, targetYear: number): string {
  if (!date || date.length < 10) return date
  return `${targetYear}${date.slice(4)}` // Keep MM-DD part, replace year
}

function assignReservaToPeriod(checkoutDate: string, periods: PricingPeriod[], normalizeYear?: boolean): string | null {
  // If normalizeYear is true, extract the period year from the first period and normalize the checkout date
  let dateToMatch = checkoutDate
  if (normalizeYear && periods.length > 0) {
    const periodYear = parseInt(periods[0].startDate.slice(0, 4))
    dateToMatch = normalizeYearForPeriod(checkoutDate, periodYear)
  }

  for (const p of periods) {
    if (p.type === "event" && dateToMatch >= p.startDate && dateToMatch <= p.endDate) return p.id
  }
  for (const p of periods) {
    if (p.type === "month" && dateToMatch >= p.startDate && dateToMatch <= p.endDate) return p.id
  }
  return null
}

function formatCurrency(value: number, compact?: boolean): string {
  if (compact && Math.abs(value) >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`
  return `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
}

function getCurrentPeriodId(periods: PricingPeriod[]): string {
  const today = new Date().toISOString().split("T")[0]
  for (const p of periods) {
    if (p.type === "event" && today >= p.startDate && today <= p.endDate) return p.id
  }
  for (const p of periods) {
    if (p.type === "month" && today >= p.startDate && today <= p.endDate) return p.id
  }
  return periods.find(p => p.endDate >= today)?.id || periods[0]?.id || ""
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { data: rawData, loading, isFirstLoad } = useDashboardData()
  const { filters } = useGlobalFilters()

  const filteredData = useMemo(() => applyGlobalFilters(rawData, filters), [rawData, filters])
  const filterOptions = useMemo(() => getFilterOptions(rawData), [rawData])

  // Core state
  const [periods, setPeriods] = useState<PricingPeriod[]>([])
  const [seasonalities, setSeasonalities] = useState<Seasonality[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState("")
  const [selectedSeasonalityId, setSelectedSeasonalityId] = useState("")
  const [configOpen, setConfigOpen] = useState(false)
  const [coherenceDialogOpen, setCoherenceDialogOpen] = useState(false)
  const [expandedCoherenceUnits, setExpandedCoherenceUnits] = useState<Set<string>>(new Set())
  const [detailUnitId, setDetailUnitId] = useState<string | null>(null)
  const [peerMode, setPeerMode] = useState<"seasonality" | "grupo">("seasonality")
  const [saving, setSaving] = useState(false)
  const [reservasDialogData, setReservasDialogData] = useState<{
    reservas: any[]
    title: string
    subtitle: string
  } | null>(null)

  // Simulator
  const [simUnitId, setSimUnitId] = useState("")
  const [simAnnualGoal, setSimAnnualGoal] = useState(0)
  const [simExpectedNights, setSimExpectedNights] = useState(20)
  const [simPeriodId, setSimPeriodId] = useState("")

  // New period form
  const [newPeriod, setNewPeriod] = useState({ name: "", shortName: "", startDate: "", endDate: "", type: "event" as "month" | "event", expectedNights: 5 })

  // Editing period
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null)
  const [editingPeriod, setEditingPeriod] = useState<Partial<PricingPeriod>>({})

  // New seasonality form
  const [newSeasonalityName, setNewSeasonalityName] = useState("")

  // ── Load from Supabase ──

  const loadPeriodsFromDb = useCallback(async () => {
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
    } catch {
      // Keep current state on error
    }
  }, [])

  const loadSeasonalitiesFromDb = useCallback(async () => {
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
    } catch {
      // Keep empty on error
    }
  }, [])

  useEffect(() => {
    loadPeriodsFromDb()
    loadSeasonalitiesFromDb()
  }, [loadPeriodsFromDb, loadSeasonalitiesFromDb])

  // Auto-select current period
  useEffect(() => {
    if (periods.length > 0 && !selectedPeriodId) {
      const current = getCurrentPeriodId(periods)
      setSelectedPeriodId(current)
      setSimPeriodId(current)
    }
  }, [periods, selectedPeriodId])

  // ── Available praças from data ──

  const allPracas = useMemo(() => {
    const set = new Set<string>()
    rawData.forEach(d => { if (d.propriedade.praca) set.add(d.propriedade.praca) })
    return Array.from(set).sort()
  }, [rawData])

  // Map praça → seasonality for quick lookup
  const pracaSeasonalityMap = useMemo(() => {
    const map = new Map<string, Seasonality>()
    seasonalities.forEach(s => {
      s.pracas.forEach(p => map.set(p, s))
    })
    return map
  }, [seasonalities])

  // Selected seasonality object (empty or "all" means no filter)
  const selectedSeasonality = useMemo(() =>
    selectedSeasonalityId && selectedSeasonalityId !== "all"
      ? seasonalities.find(s => s.id === selectedSeasonalityId) || null
      : null
    , [seasonalities, selectedSeasonalityId])

  // Filter data by selected seasonality's praças
  const seasonalityFilteredData = useMemo(() => {
    if (!selectedSeasonality) return filteredData
    const pracasSet = new Set(selectedSeasonality.pracas)
    return filteredData.filter(d => pracasSet.has(d.propriedade.praca || ""))
  }, [filteredData, selectedSeasonality])

  // ── Helper: Get primary month (1-12) for a period ──
  function getPeriodMonth(period: PricingPeriod): number {
    // For month periods, extract from start date
    // For event periods, use the month where most nights fall (or end date month)
    const endDate = new Date(period.endDate)
    return endDate.getMonth() + 1  // 1-12
  }

  // ── Helper: Find which month contains a period ──
  function getParentMonth(period: PricingPeriod): PricingPeriod | null {
    if (period.type === "month") return period
    // For events, find the month that contains it
    const monthStart = new Date(period.startDate)
    const month = periods.find(p => {
      if (p.type !== "month") return false
      const pStart = new Date(p.startDate)
      const pEnd = new Date(p.endDate)
      return monthStart >= pStart && monthStart <= pEnd
    })
    return month || null
  }

  // ── Get seasonality % for a praça+period ──
  // For months: returns the % of the YEAR
  // For events: returns (month % of year) × (event % of month) / 100
  function getSeasonalityPercent(praca: string, periodId: string): number {
    const saved = pracaSeasonalityMap.get(praca)
    const period = periods.find(p => p.id === periodId)
    if (!period) return 0

    // If no seasonality configured, use uniform distribution as fallback
    if (!saved) {
      if (period.type === "month") {
        // Distribute 100% equally among all months
        const monthCount = periods.filter(p => p.type === "month").length
        return monthCount > 0 ? 100 / monthCount : 0
      } else {
        // For events without seasonality, return 0 (requires configuration)
        return 0
      }
    }

    if (period.type === "month") {
      // For months, return the % of the year directly
      const p = saved.periods.find(pp => pp.periodId === periodId)
      if (p) return p.percent

      // Fallback to uniform distribution if not configured
      const monthCount = periods.filter(p => p.type === "month").length
      return monthCount > 0 ? 100 / monthCount : 0
    } else {
      // For events, calculate: (month % of year) × (event % of month) / 100
      const parentMonth = getParentMonth(period)
      if (!parentMonth) return 0

      const monthPercent = saved.periods.find(pp => pp.periodId === parentMonth.id)?.percent ?? 0
      const eventPercent = saved.periods.find(pp => pp.periodId === periodId)?.percent ?? 0

      return (monthPercent * eventPercent) / 100
    }
  }

  // ── Get period's share of its month's meta (%) ──
  // Month periods: 100% minus sum of event %s within that month (the "normal" share)
  // Event periods: the event's configured % of the parent month
  // Returns a fraction 0-100 to multiply with monthly meta
  function getMonthSharePercent(praca: string, period: PricingPeriod): number {
    const saved = pracaSeasonalityMap.get(praca)

    if (period.type === "event") {
      if (!saved) return 0
      const eventEntry = saved.periods.find(pp => pp.periodId === period.id)
      return eventEntry?.percent ?? 0
    }

    // For month periods: 100% minus all event %s in this month
    if (!saved) return 100

    const eventsInMonth = periods.filter(p => {
      if (p.type !== "event") return false
      const pStart = new Date(p.startDate)
      const mStart = new Date(period.startDate)
      const mEnd = new Date(period.endDate)
      return pStart >= mStart && pStart <= mEnd
    })

    const eventsTotal = eventsInMonth.reduce((sum, e) => {
      const ep = saved.periods.find(pp => pp.periodId === e.id)
      return sum + (ep?.percent ?? 0)
    }, 0)

    return Math.max(0, 100 - eventsTotal)
  }

  // ── Seasonality chart data ──
  // Shows CONFIGURED seasonality distribution (manual % per period)
  // For events, calculates the effective % of year (month % × event % / 100)

  const optimalPriceChartData = useMemo(() => {
    // When a seasonality is selected, only show periods configured in it
    const configuredPeriodIds = selectedSeasonality
      ? new Set(selectedSeasonality.periods.map(p => p.periodId))
      : null

    return [...periods]
      .filter(period => {
        // Always show all periods when no seasonality selected
        if (!configuredPeriodIds) return true
        // Always show months
        if (period.type === "month") return true
        // Only show events that are configured in the selected seasonality
        return configuredPeriodIds.has(period.id)
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map(period => {
        const expectedNights = period.expectedNights || 20
        const periodMonth = getPeriodMonth(period)

        // Meta weighted by period's share of the month (seasonality %)
        const prices = seasonalityFilteredData.map(item => {
          const praca = item.propriedade.praca || "Outros"
          const monthlyMeta = item.metas.find(m => m.mes === periodMonth)
          const fullMonthMeta = monthlyMeta?.meta || 0
          const sharePercent = getMonthSharePercent(praca, period)
          const periodGoal = fullMonthMeta * (sharePercent / 100)
          return expectedNights > 0 ? periodGoal / expectedNights : 0
        })

        const avgPrice = prices.length > 0
          ? prices.reduce((a, b) => a + b, 0) / prices.length
          : 0

        return {
          periodId: period.id,
          name: period.shortName,
          fullName: period.name,
          avgOptimalPrice: Math.round(avgPrice),
          isEvent: period.type === "event",
          isCurrent: period.id === selectedPeriodId,
        }
      })
  }, [periods, selectedPeriodId, seasonalityFilteredData, selectedSeasonality])

  // ── Unit pricing ──

  const unitPricing = useMemo((): UnitPeriodPricing[] => {
    const selectedPeriod = periods.find(p => p.id === selectedPeriodId)
    if (!selectedPeriod) return []

    return seasonalityFilteredData.map(item => {
      const praca = item.propriedade.praca || "Outros"
      const savedSeas = pracaSeasonalityMap.get(praca)

      // Get the month number (1-12) for the selected period
      const periodMonth = getPeriodMonth(selectedPeriod)

      // Get the monthly goal, weighted by this period's share of the month
      // For events: meta × eventPercent/100. For months: meta × (100 - sumEvents)/100
      const monthlyMeta = item.metas.find(m => m.mes === periodMonth)
      const fullMonthMeta = monthlyMeta?.meta || 0
      const sharePercent = getMonthSharePercent(praca, selectedPeriod)
      const periodGoal = fullMonthMeta * (sharePercent / 100)

      const expectedNights = selectedPeriod.expectedNights || 20

      const optimalPrice = expectedNights > 0 ? periodGoal / expectedNights : 0
      const periodStart = selectedPeriod.startDate
      const periodEnd = selectedPeriod.endDate
      const overlapping = (item.tarifario || []).filter(t =>
        t.from <= periodEnd && t.to >= periodStart
      )

      let currentAvg = 0
      if (overlapping.length > 0) {
        if (selectedPeriod.type === "event") {
          // For events, sort by duration ascending: shortest band = most specific (event override)
          overlapping.sort((a, b) => {
            const daysA = new Date(a.to).getTime() - new Date(a.from).getTime()
            const daysB = new Date(b.to).getTime() - new Date(b.from).getTime()
            return daysA - daysB
          })
        } else {
          // For months, to avoid holiday skew, pick the band that has the largest overlap in days
          // If tie, pick the longer overall band (the base rate)
          const pStart = new Date(periodStart).getTime()
          const pEnd = new Date(periodEnd).getTime()

          overlapping.sort((a, b) => {
            const overlapA = Math.min(pEnd, new Date(a.to).getTime()) - Math.max(pStart, new Date(a.from).getTime())
            const overlapB = Math.min(pEnd, new Date(b.to).getTime()) - Math.max(pStart, new Date(b.from).getTime())
            if (overlapB !== overlapA) return overlapB - overlapA

            const daysA = new Date(a.to).getTime() - new Date(a.from).getTime()
            const daysB = new Date(b.to).getTime() - new Date(b.from).getTime()
            return daysB - daysA
          })
        }
        currentAvg = overlapping[0].baserate
      }

      const annualGoal = item.metas.reduce((sum, m) => sum + m.meta, 0)

      let revenueShare = 0
      if (savedSeas && selectedPeriod) {
        if (selectedPeriod.type === "month") {
          const monthYearPercent = savedSeas.periods.find(sp => sp.periodId === selectedPeriod.id)?.percent || 0
          revenueShare = monthYearPercent * (sharePercent / 100)
        } else {
          const parentMonthPeriod = periods.find(p => p.type === "month" && getPeriodMonth(p) === periodMonth)
          const monthYearPercent = parentMonthPeriod
            ? (savedSeas.periods.find(sp => sp.periodId === parentMonthPeriod.id)?.percent || 0)
            : 0
          revenueShare = monthYearPercent * (sharePercent / 100)
        }
      } else {
        const monthlyMeta = item.metas.find(m => m.mes === periodMonth)
        const fullMonthMeta = monthlyMeta?.meta || 0
        revenueShare = annualGoal > 0 ? ((fullMonthMeta * (sharePercent / 100)) / annualGoal) * 100 : 0
      }

      const projectedRevenue = annualGoal * (revenueShare / 100)

      return {
        unitId: item.propriedade.idpropriedade,
        unitName: item.propriedade.nomepropriedade,
        praca,
        grupo: item.propriedade.grupo_nome || "Sem Grupo",
        periodGoal, // Mantém a meta do período calculada via fullMonthMeta
        annualGoal,
        expectedNights,
        optimalPrice,
        currentAvgPrice: currentAvg,
        priceDelta: currentAvg > 0 ? ((optimalPrice - currentAvg) / currentAvg) * 100 : 0,
        projectedRevenue,
        revenueShare,
        seasonalityName: savedSeas?.name || "Sem sazonalidade configurada",
      }
    }).sort((a, b) => b.optimalPrice - a.optimalPrice)
  }, [seasonalityFilteredData, selectedPeriodId, periods, pracaSeasonalityMap])

  // ── KPIs ──

  const kpiMetrics = useMemo(() => {
    const selectedPeriod = periods.find(p => p.id === selectedPeriodId)
    const avgOptimal = unitPricing.length > 0
      ? unitPricing.reduce((s, u) => s + u.optimalPrice, 0) / unitPricing.length : 0

    // Aderência de preço: média de (preço atual / preço ótimo) por unidade
    // Só conta unidades que têm ambos os valores > 0
    const unitsWithBothPrices = unitPricing.filter(u => u.optimalPrice > 0 && u.currentAvgPrice > 0)
    const priceAdherence = unitsWithBothPrices.length > 0
      ? (unitsWithBothPrices.reduce((s, u) => s + (u.currentAvgPrice / u.optimalPrice), 0) / unitsWithBothPrices.length) * 100
      : 0

    const pracas = new Set(seasonalityFilteredData.map(d => d.propriedade.praca)).size
    return { selectedPeriod, avgOptimal, priceAdherence, unitsWithPrices: unitsWithBothPrices.length, pracas, totalUnits: unitPricing.length }
  }, [unitPricing, seasonalityFilteredData, periods, selectedPeriodId])

  // ── Coherence ranking (for dialog) ──

  const coherenceRanking = useMemo(() => {
    return unitPricing
      .map(unit => {
        const hasTarifario = unit.currentAvgPrice > 0
        const deviation = hasTarifario && unit.optimalPrice > 0
          ? ((unit.currentAvgPrice - unit.optimalPrice) / unit.optimalPrice) * 100
          : null
        return {
          unitId: unit.unitId,
          unitName: unit.unitName,
          praca: unit.praca,
          optimalPrice: unit.optimalPrice,
          currentAvgPrice: unit.currentAvgPrice,
          deviation,
          absDeviation: deviation !== null ? Math.abs(deviation) : -1,
          expectedNights: unit.expectedNights,
          projectedRevenue: unit.projectedRevenue,
          revenueShare: unit.revenueShare,
        }
      })
      .sort((a, b) => {
        if (a.deviation === null && b.deviation === null) return 0
        if (a.deviation === null) return 1
        if (b.deviation === null) return -1
        return b.absDeviation - a.absDeviation
      })
  }, [unitPricing])

  // ── Property detail (sheet) ──

  const detailUnit = useMemo(() => {
    if (!detailUnitId) return null
    return rawData.find(d => d.propriedade.idpropriedade === detailUnitId) || null
  }, [detailUnitId, rawData])

  const detailUnitPricing = useMemo(() => {
    if (!detailUnitId) return null
    return unitPricing.find(u => u.unitId === detailUnitId) || null
  }, [detailUnitId, unitPricing])

  const peerAnalysis = useMemo(() => {
    if (!detailUnit || !detailUnitId) return []

    const selectedPeriod = periods.find(p => p.id === selectedPeriodId)
    if (!selectedPeriod) return []

    const periodStart = selectedPeriod.startDate
    const periodEnd = selectedPeriod.endDate
    const myMaxGuests = detailUnit.propriedade._i_maxguests ?? null
    const myGrupo = detailUnit.propriedade.grupo_nome
    const myPraca = detailUnit.propriedade.praca

    // Helper: check if two properties share similar tipology (±1 maxguests)
    // Both must have valid _i_maxguests for comparison
    const isSameTypology = (guestsA: number | null | undefined, guestsB: number | null | undefined) => {
      if (guestsA == null || guestsB == null) return false
      return Math.abs(guestsA - guestsB) <= 1
    }

    // Determine peers based on mode
    let peerProperties: typeof rawData
    if (peerMode === "seasonality") {
      // Nível Máximo: same tipologia (±1 maxguests) AND same grupo
      peerProperties = rawData.filter(d => {
        const sameTypo = isSameTypology(d.propriedade._i_maxguests, myMaxGuests)
        return sameTypo && d.propriedade.grupo_nome === myGrupo
      })
    } else {
      // Nível Médio: same tipologia (±1 maxguests) AND same praça, OR only same grupo
      peerProperties = rawData.filter(d => {
        const sameTypo = isSameTypology(d.propriedade._i_maxguests, myMaxGuests)
        const samePraca = d.propriedade.praca === myPraca
        const sameGrupo = d.propriedade.grupo_nome === myGrupo
        return (sameTypo && samePraca) || sameGrupo
      })
    }

    // Calculate period days for occupancy
    const periodDays = Math.max(1, Math.ceil((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / (1000 * 60 * 60 * 24)) + 1)

    // Calculate metrics for current period (checkout-based)
    const peerData = peerProperties.map(item => {
      // Valor Vendido (reservetotal where checkout in period)
      const periodReservas = item.reservas.filter((r: any) =>
        r.checkoutdate >= periodStart && r.checkoutdate <= periodEnd
      )
      const valorVendido = periodReservas.reduce((sum: number, r: any) => sum + (r.reservetotal || 0), 0)

      // Tarifário Trabalhado (using metricas.precoMedioNoite for consistency with "Tarifário Atual")
      const tarifarioTrabalhado = item.metricas?.precoMedioNoite || item.propriedade.valor_tarifario || (item.propriedade as any).baserate_atual || 0

      // Meta (checkout-based for this month)
      const periodMonth = selectedPeriod.startDate.slice(0, 7)
      const meta = item.metas
        ?.filter((m: any) => String(m.data_especifica || '').startsWith(periodMonth))
        .reduce((sum: number, m: any) => sum + (m.meta || 0), 0) || 0

      const percentualMeta = meta > 0 ? (valorVendido / meta) * 100 : 0

      // Ocupação no período (replacing RAC)
      let occupiedDays = 0
      if (item.ocupacao?.length > 0) {
        occupiedDays = item.ocupacao.filter((o: any) =>
          o.datas >= periodStart && o.datas <= periodEnd && o.ocupado === 1
        ).length
      }
      const occupancyPct = Math.round((occupiedDays / periodDays) * 100)

      return {
        unitId: item.propriedade.idpropriedade,
        unitName: item.propriedade.nomepropriedade,
        rooms: item.propriedade._i_rooms || 0,
        maxGuests: item.propriedade._i_maxguests || 0,
        tarifarioTrabalhado: Math.round(tarifarioTrabalhado),
        valorVendido: Math.round(valorVendido),
        percentualMeta: Number(percentualMeta.toFixed(1)),
        occupancyPct,
        reservaCount: periodReservas.length,
        isSelected: item.propriedade.idpropriedade === detailUnitId,
      }
    })

    // Sort by valorVendido desc, ensure selected unit is always included
    const sorted = peerData.sort((a, b) => b.valorVendido - a.valorVendido)
    const top15 = sorted.slice(0, 15)
    const selectedInTop = top15.some(p => p.isSelected)
    if (!selectedInTop) {
      const selectedPeer = sorted.find(p => p.isSelected)
      if (selectedPeer) return [...top15.slice(0, 14), selectedPeer]
    }
    return top15
  }, [detailUnit, detailUnitId, rawData, peerMode, periods, selectedPeriodId])

  // Historical comparison (year-over-year)
  const historicalComparison = useMemo(() => {
    if (!detailUnit || !detailUnitId) return null
    const selectedPeriod = periods.find(p => p.id === selectedPeriodId)
    if (!selectedPeriod) return null

    const periodStart = selectedPeriod.startDate
    const periodEnd = selectedPeriod.endDate
    const prevYearStart = periodStart.replace(/^\d{4}/, (y) => String(Number(y) - 1))
    const prevYearEnd = periodEnd.replace(/^\d{4}/, (y) => String(Number(y) - 1))
    const periodMonth = selectedPeriod.startDate.slice(0, 7)
    const prevPeriodMonth = prevYearStart.slice(0, 7)

    // Current year
    const currentReservas = detailUnit.reservas.filter((r: any) =>
      r.checkoutdate >= periodStart && r.checkoutdate <= periodEnd
    )
    const currentValorVendido = currentReservas.reduce((sum: number, r: any) => sum + (r.reservetotal || 0), 0)
    const currentDiariaMedia = currentReservas.length > 0
      ? currentReservas.reduce((sum: number, r: any) => sum + (r.pricepernight || 0), 0) / currentReservas.length
      : 0
    const currentMeta = detailUnit.metas
      ?.filter((m: any) => String(m.data_especifica || '').startsWith(periodMonth))
      .reduce((sum: number, m: any) => sum + (m.meta || 0), 0) || 0
    const currentPctMeta = currentMeta > 0 ? (currentValorVendido / currentMeta) * 100 : 0

    // Previous year
    const prevReservas = detailUnit.reservas.filter((r: any) =>
      r.checkoutdate >= prevYearStart && r.checkoutdate <= prevYearEnd
    )
    const prevValorVendido = prevReservas.reduce((sum: number, r: any) => sum + (r.reservetotal || 0), 0)
    const prevDiariaMedia = prevReservas.length > 0
      ? prevReservas.reduce((sum: number, r: any) => sum + (r.pricepernight || 0), 0) / prevReservas.length
      : 0
    const prevMeta = detailUnit.metas
      ?.filter((m: any) => String(m.data_especifica || '').startsWith(prevPeriodMonth))
      .reduce((sum: number, m: any) => sum + (m.meta || 0), 0) || 0
    const prevPctMeta = prevMeta > 0 ? (prevValorVendido / prevMeta) * 100 : 0

    const hasData = prevReservas.length > 0 || prevMeta > 0

    return {
      hasData,
      current: { diariaMedia: Math.round(currentDiariaMedia), valorVendido: currentValorVendido, pctMeta: currentPctMeta, reservas: currentReservas },
      previous: { diariaMedia: Math.round(prevDiariaMedia), valorVendido: prevValorVendido, pctMeta: prevPctMeta, reservas: prevReservas },
      prevYearStart, prevYearEnd
    }
  }, [detailUnit, detailUnitId, periods, selectedPeriodId])

  // ── Simulator ──

  const simResults = useMemo(() => {
    if (!simUnitId || !simPeriodId) return null
    const unit = seasonalityFilteredData.find(d => d.propriedade.idpropriedade === simUnitId)
    if (!unit) return null

    const praca = unit.propriedade.praca || "Outros"

    // Get the month number for the simulation period
    const period = periods.find(p => p.id === simPeriodId)
    if (!period) return null
    const periodMonth = getPeriodMonth(period)

    // Get monthly goal weighted by period's share
    const monthlyMeta = unit.metas.find(m => m.mes === periodMonth)
    const fullMonthMeta = monthlyMeta?.meta || simAnnualGoal || 0
    const sharePercent = getMonthSharePercent(praca, period)
    const periodGoal = fullMonthMeta * (sharePercent / 100)

    const optimalPrice = simExpectedNights > 0 ? periodGoal / simExpectedNights : 0
    const currentAvg = unit.metricas?.precoMedioNoite || 0

    // Calculate seasonPercent for display (optional, can be removed if not used)
    const seasonPercent = 0

    return {
      periodGoal, optimalPrice, seasonPercent, currentAvg, pracaName: praca,
      priceDelta: currentAvg > 0 ? ((optimalPrice - currentAvg) / currentAvg) * 100 : 0,
    }
  }, [simUnitId, simPeriodId, simAnnualGoal, simExpectedNights, seasonalityFilteredData, pracaSeasonalityMap, periods])

  // ── CRUD Handlers ──

  async function handleCreatePeriod() {
    if (!newPeriod.name || !newPeriod.startDate || !newPeriod.endDate) return
    setSaving(true)

    // Optimistic: add to local state immediately
    const tempId = `temp-${Date.now()}`
    const optimisticPeriod: PricingPeriod = {
      id: tempId,
      name: newPeriod.name,
      shortName: newPeriod.shortName || newPeriod.name.slice(0, 4),
      startDate: newPeriod.startDate,
      endDate: newPeriod.endDate,
      type: newPeriod.type,
      expectedNights: newPeriod.expectedNights,
      sortOrder: 0,
    }
    setPeriods(prev => [...prev, optimisticPeriod].sort((a, b) => a.startDate.localeCompare(b.startDate)))
    setNewPeriod({ name: "", shortName: "", startDate: "", endDate: "", type: "event", expectedNights: 5 })

    try {
      await fetch("/api/pricing/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: optimisticPeriod.name,
          short_name: optimisticPeriod.shortName,
          start_date: optimisticPeriod.startDate,
          end_date: optimisticPeriod.endDate,
          type: optimisticPeriod.type,
          expected_nights: optimisticPeriod.expectedNights,
          sort_order: 0,
        }),
      })
      // Sync with DB to get the real UUID
      await loadPeriodsFromDb()
    } catch {
      // Rollback on error
      setPeriods(prev => prev.filter(p => p.id !== tempId))
    } finally { setSaving(false) }
  }

  async function handleDeletePeriod(id: string) {
    setSaving(true)
    // Optimistic: remove from local state immediately
    const backup = periods
    setPeriods(prev => prev.filter(p => p.id !== id))
    try {
      await fetch(`/api/pricing/periods?id=${id}`, { method: "DELETE" })
    } catch {
      // Rollback on error
      setPeriods(backup)
    } finally { setSaving(false) }
  }

  async function handleUpdatePeriodNights(id: string, nights: number) {
    await fetch("/api/pricing/periods", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, expected_nights: nights }),
    })
  }

  function startEditPeriod(period: PricingPeriod) {
    setEditingPeriodId(period.id)
    setEditingPeriod({ ...period })
  }

  async function handleSaveEditPeriod() {
    if (!editingPeriodId || !editingPeriod.name) return
    setSaving(true)

    // Optimistic: update local state immediately
    const backup = periods
    setPeriods(prev => prev.map(p =>
      p.id === editingPeriodId
        ? { ...p, ...editingPeriod as PricingPeriod }
        : p
    ).sort((a, b) => a.startDate.localeCompare(b.startDate)))
    setEditingPeriodId(null)
    setEditingPeriod({})

    try {
      const payload: Record<string, unknown> = { id: editingPeriodId }
      if (editingPeriod.name) payload.name = editingPeriod.name
      if (editingPeriod.shortName) payload.short_name = editingPeriod.shortName
      if (editingPeriod.startDate) payload.start_date = editingPeriod.startDate
      if (editingPeriod.endDate) payload.end_date = editingPeriod.endDate
      if (editingPeriod.type) payload.type = editingPeriod.type
      if (editingPeriod.expectedNights != null) payload.expected_nights = editingPeriod.expectedNights

      const res = await fetch("/api/pricing/periods", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!result.success) {
        console.error("[Pricing] Failed to update period:", result.error)
        setPeriods(backup) // Rollback
      }
    } catch (err) {
      console.error("[Pricing] Error saving period:", err)
      setPeriods(backup) // Rollback
    } finally { setSaving(false) }
  }

  async function handleCreateSeasonality() {
    if (!newSeasonalityName) return
    setSaving(true)
    try {
      await fetch("/api/pricing/seasonalities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSeasonalityName, pracas: [], periods: [] }),
      })
      await loadSeasonalitiesFromDb()
      setNewSeasonalityName("")
    } finally { setSaving(false) }
  }

  async function handleDeleteSeasonality(id: string) {
    setSaving(true)
    try {
      await fetch(`/api/pricing/seasonalities?id=${id}`, { method: "DELETE" })
      await loadSeasonalitiesFromDb()
    } finally { setSaving(false) }
  }

  async function handleSaveSeasonality(seasonality: Seasonality) {
    setSaving(true)
    try {
      const res = await fetch("/api/pricing/seasonalities", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: seasonality.id,
          name: seasonality.name,
          pracas: seasonality.pracas,
          periods: seasonality.periods.map(p => ({ period_id: p.periodId, percent: p.percent })),
        }),
      })
      const result = await res.json()
      if (!result.success) {
        console.error("[Pricing] Save seasonality failed:", result.error)
      }
      await loadSeasonalitiesFromDb()
    } finally { setSaving(false) }
  }

  function handleSelectUnit(unitId: string) {
    setSimUnitId(unitId)
    const unit = unitPricing.find(u => u.unitId === unitId)
    if (unit) {
      setSimAnnualGoal(Math.round(unit.periodGoal))
      setSimExpectedNights(unit.expectedNights)
      setSimPeriodId(selectedPeriodId)
    }
  }

  // ── Availability Calendar Helper ──
  function renderAvailabilityCalendar(unitId: string) {
    return (
      <AvailabilityCalendar
        unitId={unitId}
        rawData={rawData}
        periods={periods}
        selectedPeriodId={selectedPeriodId}
        pracaSeasonalityMap={pracaSeasonalityMap}
      />
    );
  }

  // ── Loading ──

  if (isFirstLoad) return <InitialLoadingScreen />
  if (loading && rawData.length === 0) return <PricingSkeleton />

  // Filter periods by selected seasonality (hide unconfigured events)
  const configuredPeriodIds = selectedSeasonality
    ? new Set(selectedSeasonality.periods.map(p => p.periodId))
    : null

  const sortedPeriods = [...periods]
    .filter(p => !configuredPeriodIds || p.type === "month" || configuredPeriodIds.has(p.id))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  return (
    <div className="space-y-5 p-6 max-w-[1400px]">
      {/* Global Filters */}
      <FilterBar filterOptions={filterOptions} />

      {/* Header + Seasonality Selector */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Precificação</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Índice de sazonalidade e preço ótimo por período</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Select value={selectedSeasonalityId} onValueChange={setSelectedSeasonalityId}>
            <SelectTrigger className="h-9 w-[220px] text-xs">
              <SelectValue placeholder="Todas as sazonalidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as sazonalidades</SelectItem>
              {seasonalities.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.pracas.length} praças)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="shrink-0 h-9" onClick={() => setConfigOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Período</p>
            </div>
            <p className="text-xl font-semibold">{kpiMetrics.selectedPeriod?.name || "—"}</p>
            {kpiMetrics.selectedPeriod && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDateDDMM(kpiMetrics.selectedPeriod.startDate)} – {formatDateDDMM(kpiMetrics.selectedPeriod.endDate)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-blue-600" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preço Ótimo Médio</p>
            </div>
            <p className="text-xl font-semibold text-blue-600">{formatCurrency(kpiMetrics.avgOptimal)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Média do portfólio</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setCoherenceDialogOpen(true)}>
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Coerência de Preço</p>
            </div>
            <p className={`text - xl font - semibold ${kpiMetrics.priceAdherence >= 90 && kpiMetrics.priceAdherence <= 110 ? "text-emerald-600" : kpiMetrics.priceAdherence > 0 ? "text-red-600" : "text-muted-foreground"} `}>
              {kpiMetrics.priceAdherence > 0 ? `${kpiMetrics.priceAdherence.toFixed(1)}% ` : "—"}
            </p>
            {kpiMetrics.priceAdherence > 0 ? (
              <p className="text-xs text-muted-foreground mt-0.5">{kpiMetrics.unitsWithPrices} unidades com tarifário · Clique para detalhes</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">Sem tarifário no período</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Portfólio</p>
            </div>
            <p className="text-xl font-semibold">{kpiMetrics.totalUnits}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpiMetrics.pracas} praças · {seasonalities.length} sazonalidades</p>
          </CardContent>
        </Card>
      </div>

      {/* Period Selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {sortedPeriods.map(period => (
          <Badge
            key={period.id}
            variant={selectedPeriodId === period.id ? "default" : "outline"}
            className={`cursor - pointer whitespace - nowrap px - 3 py - 1 text - xs transition - colors ${selectedPeriodId === period.id ? "" : "hover:bg-muted"} `}
            onClick={() => setSelectedPeriodId(period.id)}
          >
            {period.type === "event" && <Star className="h-3 w-3 mr-1 fill-current" />}
            {period.shortName}
          </Badge>
        ))}
      </div>

      {/* Optimal Price Line Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Preço Ótimo Médio por Período</CardTitle>
          <CardDescription className="text-[11px]">Variação do preço ótimo médio do portfólio ao longo do ano</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={optimalPriceChartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#334155" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v: number) => `R$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)} `} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 13 }}
                  formatter={(v: any) => [formatCurrency(v), "Preço Ótimo Médio"]}
                  labelFormatter={(_: any, payload: any[]) => payload?.[0]?.payload?.fullName || _}
                />
                <Line
                  type="monotone"
                  dataKey="avgOptimalPrice"
                  stroke="#60a5fa"
                  strokeWidth={2.5}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props
                    if (payload.isCurrent) {
                      return <circle key={props.key} cx={cx} cy={cy} r={6} fill="#3b82f6" stroke="#fff" strokeWidth={2} />
                    }
                    return <circle key={props.key} cx={cx} cy={cy} r={3.5} fill={payload.isEvent ? "#1e40af" : "#60a5fa"} stroke="#fff" strokeWidth={1.5} />
                  }}
                  activeDot={{ r: 6, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Units Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">Preço Ótimo por Unidade</CardTitle>
              <CardDescription className="text-[11px]">
                Período: {kpiMetrics.selectedPeriod?.name || "—"} · {kpiMetrics.selectedPeriod?.expectedNights || 0} noites esperadas
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">{unitPricing.length} unidades</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[420px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="text-xs">Unidade</TableHead>
                  <TableHead className="text-xs">Praça</TableHead>
                  <TableHead className="text-xs text-right">Meta do Período</TableHead>
                  <TableHead className="text-xs text-right">Preço Ótimo</TableHead>
                  <TableHead className="text-xs text-right">Preço Atual</TableHead>
                  <TableHead className="text-xs text-right">Delta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unitPricing.map(unit => (
                  <TableRow key={unit.unitId} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setDetailUnitId(unit.unitId)}>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">{unit.unitName}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{unit.praca}</Badge></TableCell>
                    <TableCell className="text-right text-sm font-mono font-bold">{formatCurrency(unit.periodGoal, true)}</TableCell>
                    <TableCell className="text-right text-sm font-mono font-bold text-blue-600">{formatCurrency(unit.optimalPrice)}</TableCell>
                    <TableCell className="text-right text-sm font-mono text-muted-foreground">{unit.currentAvgPrice > 0 ? formatCurrency(unit.currentAvgPrice) : "—"}</TableCell>
                    <TableCell className="text-right">
                      {unit.currentAvgPrice > 0 ? (
                        <Badge variant={Math.abs(unit.priceDelta) < 15 ? "secondary" : "destructive"} className="text-[10px] font-mono">
                          {unit.priceDelta > 0 ? "+" : ""}{unit.priceDelta.toFixed(0)}%
                        </Badge>
                      ) : <span className="text-[10px] text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {unitPricing.length === 0 && <p className="text-center py-10 text-sm text-muted-foreground">Nenhuma unidade encontrada.</p>}
        </CardContent>
      </Card>

      {/* Simulator */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Simulador de Preço Ótimo</CardTitle>
          <CardDescription className="text-[11px]">Selecione uma unidade e ajuste os parâmetros.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Unidade</Label>
              <Select value={simUnitId} onValueChange={(v) => { setSimUnitId(v); const u = unitPricing.find(u => u.unitId === v); if (u) { setSimAnnualGoal(Math.round(u.periodGoal)); setSimExpectedNights(u.expectedNights) } }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar unidade" /></SelectTrigger>
                <SelectContent>{filteredData.map(item => (<SelectItem key={item.propriedade.idpropriedade} value={item.propriedade.idpropriedade}>{item.propriedade.nomepropriedade}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Período</Label>
              <Select value={simPeriodId} onValueChange={setSimPeriodId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar período" /></SelectTrigger>
                <SelectContent>{sortedPeriods.map(p => (<SelectItem key={p.id} value={p.id}>{p.type === "event" ? `⭐ ${p.name} ` : p.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Meta do Período (R$)</Label>
              <Input type="number" value={simAnnualGoal || ""} onChange={e => setSimAnnualGoal(Number(e.target.value))} className="h-9 font-mono" placeholder="23900" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Noites Esperadas: {simExpectedNights}</Label>
              <Slider value={[simExpectedNights]} min={1} max={30} step={1} onValueChange={v => setSimExpectedNights(v[0])} className="mt-2" />
            </div>
          </div>
          {simResults && (
            <div className="grid grid-cols-3 gap-3 pt-4 border-t">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Preço Ótimo</p>
                <p className="text-lg font-bold text-blue-700 mt-0.5">{formatCurrency(simResults.optimalPrice)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Meta do Período</p>
                <p className="text-lg font-bold mt-0.5">{formatCurrency(simResults.periodGoal, true)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">vs Atual</p>
                <p className={`text - lg font - bold mt - 0.5 ${simResults.priceDelta > 0 ? "text-emerald-600" : simResults.priceDelta < -15 ? "text-red-600" : ""} `}>
                  {simResults.currentAvg > 0 ? `${simResults.priceDelta > 0 ? "+" : ""}${simResults.priceDelta.toFixed(0)}% ` : "—"}
                </p>
              </div>
            </div>
          )}
          {!simUnitId && <p className="text-center py-4 text-sm text-muted-foreground">Clique em uma unidade na tabela acima ou selecione no menu para simular.</p>}
        </CardContent>
      </Card>

      {/* ── Config Dialog ── */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-3xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg">Configurações de Precificação</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="periods" className="mt-2">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="periods">Períodos</TabsTrigger>
              <TabsTrigger value="seasonalities">Sazonalidades</TabsTrigger>
            </TabsList>

            {/* ── Periods Tab ── */}
            <TabsContent value="periods" className="space-y-4 mt-4">
              {/* Edit form - shown above table when editing */}
              {editingPeriodId && (
                <div className="border-2 border-blue-200 rounded-lg p-4 space-y-3 bg-blue-50/30">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-blue-900 uppercase">Editando: {editingPeriod.name}</p>
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 text-xs" onClick={handleSaveEditPeriod} disabled={saving}>
                        {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingPeriodId(null); setEditingPeriod({}) }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Nome</Label>
                      <Input className="h-8 text-sm" value={editingPeriod.name || ""} onChange={e => setEditingPeriod(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Abreviação</Label>
                      <Input className="h-8 text-sm" value={editingPeriod.shortName || ""} onChange={e => setEditingPeriod(p => ({ ...p, shortName: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Tipo</Label>
                      <Select value={editingPeriod.type || "month"} onValueChange={(v: "month" | "event") => setEditingPeriod(p => ({ ...p, type: v }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="event">Evento</SelectItem>
                          <SelectItem value="month">Mês</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Início</Label>
                      <Input type="date" className="h-8 text-sm" value={editingPeriod.startDate || ""} onChange={e => setEditingPeriod(p => ({ ...p, startDate: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Fim</Label>
                      <Input type="date" className="h-8 text-sm" value={editingPeriod.endDate || ""} onChange={e => setEditingPeriod(p => ({ ...p, endDate: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Noites</Label>
                      <Input type="number" className="h-8 text-sm font-mono" value={editingPeriod.expectedNights || 1} min={1} max={31} onChange={e => setEditingPeriod(p => ({ ...p, expectedNights: Number(e.target.value) || 1 }))} />
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Nome</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Início</TableHead>
                      <TableHead className="text-xs">Fim</TableHead>
                      <TableHead className="text-xs text-right">Noites</TableHead>
                      <TableHead className="text-xs w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPeriods.map(period => (
                      <TableRow key={period.id} className={editingPeriodId === period.id ? "bg-blue-50/50" : ""}>
                        <TableCell className="font-medium text-sm">{period.name}</TableCell>
                        <TableCell>
                          <Badge variant={period.type === "event" ? "default" : "outline"} className="text-[10px]">
                            {period.type === "event" ? "Evento" : "Mês"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateDDMM(period.startDate)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateDDMM(period.endDate)}</TableCell>
                        <TableCell className="text-right text-sm font-mono">{period.expectedNights}</TableCell>
                        <TableCell>
                          <div className="flex gap-0.5">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-600" onClick={() => startEditPeriod(period)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600" onClick={() => handleDeletePeriod(period.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Add new period */}
              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase">Novo período</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Input placeholder="Nome" value={newPeriod.name} onChange={e => setNewPeriod(p => ({ ...p, name: e.target.value }))} className="h-8 text-sm" />
                  <Input placeholder="Abrev." value={newPeriod.shortName} onChange={e => setNewPeriod(p => ({ ...p, shortName: e.target.value }))} className="h-8 text-sm" />
                  <Select value={newPeriod.type} onValueChange={(v: "month" | "event") => setNewPeriod(p => ({ ...p, type: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="event">Evento</SelectItem>
                      <SelectItem value="month">Mês</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Input type="date" value={newPeriod.startDate} onChange={e => setNewPeriod(p => ({ ...p, startDate: e.target.value }))} className="h-8 text-sm" />
                  <Input type="date" value={newPeriod.endDate} onChange={e => setNewPeriod(p => ({ ...p, endDate: e.target.value }))} className="h-8 text-sm" />
                  <Input type="number" placeholder="Noites" value={newPeriod.expectedNights} onChange={e => setNewPeriod(p => ({ ...p, expectedNights: Number(e.target.value) }))} className="h-8 text-sm" />
                </div>
                <Button size="sm" onClick={handleCreatePeriod} disabled={saving || !newPeriod.name}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                  Criar Período
                </Button>
              </div>
            </TabsContent>

            {/* ── Seasonalities Tab ── */}
            <TabsContent value="seasonalities" className="space-y-4 mt-4">
              {seasonalities.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma sazonalidade configurada. Crie uma abaixo para definir os % por período.
                </p>
              )}

              {seasonalities.map(seas => (
                <SeasonalityEditor
                  key={seas.id}
                  seasonality={seas}
                  allPracas={allPracas}
                  assignedPracas={pracaSeasonalityMap}
                  periods={sortedPeriods}
                  onSave={handleSaveSeasonality}
                  onDelete={handleDeleteSeasonality}
                  saving={saving}
                />
              ))}

              {/* Add new seasonality */}
              <div className="flex gap-2 pt-2 border-t">
                <Input placeholder="Nome da sazonalidade (ex: Litoral Norte AL)" value={newSeasonalityName} onChange={e => setNewSeasonalityName(e.target.value)} className="h-9 text-sm" />
                <Button size="sm" onClick={handleCreateSeasonality} disabled={saving || !newSeasonalityName} className="shrink-0">
                  {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                  Criar
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Coherence Detail Dialog */}
      <Dialog open={coherenceDialogOpen} onOpenChange={setCoherenceDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-7xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-5 shrink-0 border-b border-border/40">
            <DialogTitle className="text-[17px] font-semibold tracking-tight">Coerência de Preço</DialogTitle>
            <p className="text-[12px] text-muted-foreground/80 mt-0.5">
              Ranking de desvio entre tarifário atual e preço ótimo — Período: {kpiMetrics.selectedPeriod?.name || "—"}
            </p>
          </DialogHeader>

          <div className="px-6 py-5 overflow-y-auto flex-1 max-h-[70vh]">
            {/* Dispersion Chart */}
            {coherenceRanking.length > 0 && (
              <div className="mb-8 p-5 bg-background border rounded-lg shadow-sm">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Dispersão: Tarifa vs. Preço Ótimo</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Imóveis abaixo da linha pontilhada estão subprecificados (Baratos). Acima, estão sobreprecificados (Caros).
                  </p>
                </div>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        type="number"
                        dataKey="optimalPrice"
                        name="Preço Ótimo"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickFormatter={(v: number) => `R$${v} `}
                      />
                      <YAxis
                        type="number"
                        dataKey="currentAvgPrice"
                        name="Tarifa"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickFormatter={(v: number) => `R$${v} `}
                      />
                      <ZAxis type="number" range={[40, 40]} />
                      <RechartsTooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: 12 }}
                        formatter={(value: any, name: string) => [formatCurrency(value as number), name === "optimalPrice" ? "Preço Ótimo" : "Tarifa Atual"]}
                        labelFormatter={() => ""}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-background border p-3 rounded-md shadow-md text-xs">
                                <p className="font-semibold mb-2">{data.unitName}</p>
                                <div className="space-y-1">
                                  <p><span className="text-muted-foreground">Preço Ótimo:</span> <span className="font-mono text-blue-600">{formatCurrency(data.optimalPrice)}</span></p>
                                  <p><span className="text-muted-foreground">Tarifa Atual:</span> <span className="font-mono">{formatCurrency(data.currentAvgPrice)}</span></p>
                                  <p><span className="text-muted-foreground">Desvio:</span> <span className={`font - mono ${data.deviation !== null && data.deviation > 0 ? "text-red-600" : "text-emerald-600"} `}>{data.deviation !== null ? `${data.deviation > 0 ? "+" : ""}${data.deviation.toFixed(1)}% ` : "—"}</span></p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      {/* Referência x=y assumindo min(0) ate max(grafico) */}
                      {(() => {
                        const maxVal = Math.max(
                          ...coherenceRanking.map(u => Math.max(u.optimalPrice, u.currentAvgPrice))
                        ) * 1.1; // 10% de folga
                        return (
                          <ReferenceLine
                            segment={[{ x: 0, y: 0 }, { x: maxVal, y: maxVal }]}
                            stroke="#94a3b8"
                            strokeDasharray="4 4"
                          />
                        )
                      })()}
                      <Scatter data={coherenceRanking.filter(u => u.currentAvgPrice > 0)}>
                        {coherenceRanking.filter(u => u.currentAvgPrice > 0).map((entry, index) => {
                          const isCheap = entry.deviation !== null && entry.deviation < 0;
                          return <Cell key={`cell - ${index} `} fill={isCheap ? "#10b981" : "#ef4444"} bg-opacity={0.8} />
                        })}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* Vies: Barato */}
              {coherenceRanking.filter(u => u.deviation !== null && u.deviation <= 0).length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="h-5 w-[3px] rounded-full bg-emerald-500"></div>
                    <h3 className="text-[13px] font-semibold text-foreground tracking-tight">Subprecificados</h3>
                    <span className="text-[11px] font-mono text-muted-foreground tabular-nums">{coherenceRanking.filter(u => u.deviation !== null && u.deviation <= 0).length}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground ml-[15px] mb-4">
                    Abaixo do preço ótimo. Com essa tarifa e a ocupação projetada, a meta pode não ser batida.
                  </p>

                  <div className="space-y-2">
                    {coherenceRanking.filter(u => u.deviation !== null && u.deviation <= 0).map(unit => {
                      const isExpanded = expandedCoherenceUnits.has(unit.unitId)
                      return (
                        <div
                          key={unit.unitId}
                          className="rounded-xl border border-border/60 bg-card transition-all duration-200 hover:shadow-sm overflow-hidden"
                        >
                          {/* Collapsed Row — single horizontal line */}
                          <div className="flex items-center gap-4 px-5 py-3.5">
                            {/* Unit info */}
                            <div className="flex-1 min-w-0">
                              <a
                                href={`https://beto.stays.com.br/i/apartment/${unit.unitId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[13px] font-semibold text-foreground truncate block hover:text-blue-600 transition-colors"
                                title={`Ver ${unit.unitName} na Stays`}
                              >
                                {unit.unitName}
                              </a>
                              <span className="text-[10px] text-muted-foreground/70 font-medium mt-0.5 block">{unit.praca}</span>
                            </div>

                            {/* Price columns */}
                            <div className="hidden sm:flex items-center gap-6 shrink-0">
                              <div className="text-right w-[90px]">
                                <p className="text-[9px] text-muted-foreground/60 uppercase font-medium tracking-wider leading-none mb-0.5">Ótimo</p>
                                <p className="text-[13px] font-mono font-bold text-blue-600 leading-tight">{formatCurrency(unit.optimalPrice)}</p>
                              </div>
                              <div className="text-right w-[90px]">
                                <p className="text-[9px] text-muted-foreground/60 uppercase font-medium tracking-wider leading-none mb-0.5">Tarifa</p>
                                <p className="text-[13px] font-mono font-medium text-foreground/80 leading-tight">{unit.currentAvgPrice > 0 ? formatCurrency(unit.currentAvgPrice) : "—"}</p>
                              </div>
                            </div>

                            {/* Deviation badge */}
                            <div className="shrink-0 w-[68px] flex justify-center">
                              <span className="inline-flex items-center justify-center text-[12px] font-mono font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 min-w-[60px]">
                                {unit.deviation !== null ? `${unit.deviation.toFixed(0)}%` : "—"}
                              </span>
                            </div>

                            {/* Ver detalhes button — right aligned */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0 h-8 px-3 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg gap-1.5 transition-colors"
                              onClick={() => {
                                setExpandedCoherenceUnits(prev => {
                                  const next = new Set(prev)
                                  if (next.has(unit.unitId)) next.delete(unit.unitId)
                                  else next.add(unit.unitId)
                                  return next
                                })
                              }}
                            >
                              {isExpanded ? (
                                <>Menos <ChevronDown className="h-3 w-3 rotate-180 transition-transform" /></>
                              ) : (
                                <>Detalhes <ChevronDown className="h-3 w-3 transition-transform" /></>
                              )}
                            </Button>
                          </div>

                          {/* Expanded Content */}
                          {isExpanded && (
                            <div className="border-t border-border/40 bg-muted/5 px-5 py-5 animate-in fade-in slide-in-from-top-1 duration-200">
                              {/* KPI strip */}
                              <div className="grid grid-cols-3 gap-3 mb-5">
                                <div className="bg-background rounded-lg border border-border/40 p-3.5">
                                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium mb-1">Ocupação Projetada</p>
                                  <p className="text-base font-semibold text-foreground tabular-nums">{unit.expectedNights} <span className="text-[11px] font-normal text-muted-foreground">noites</span></p>
                                </div>
                                <div className="bg-background rounded-lg border border-border/40 p-3.5">
                                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium mb-1">Fat. Projetado</p>
                                  <p className="text-base font-semibold text-foreground font-mono tabular-nums">{formatCurrency(unit.projectedRevenue)}</p>
                                </div>
                                <div className="bg-background rounded-lg border border-border/40 p-3.5">
                                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium mb-1">% do Consolidado Anual</p>
                                  <p className="text-base font-semibold text-blue-600 font-mono tabular-nums">{unit.revenueShare > 0 ? `${unit.revenueShare.toFixed(1)}%` : "—"}</p>
                                </div>
                              </div>
                              {/* Calendar + Competitor side by side */}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                <div>{renderAvailabilityCalendar(unit.unitId)}</div>
                                <div>
                                  <CompetitorAnalysisCard
                                    unitId={unit.unitId}
                                    unitName={unit.unitName}
                                    currentPrice={unit.currentAvgPrice}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Vies: Caro */}
              {coherenceRanking.filter(u => u.deviation !== null && u.deviation > 0).length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="h-5 w-[3px] rounded-full bg-red-500"></div>
                    <h3 className="text-[13px] font-semibold text-foreground tracking-tight">Sobreprecificados</h3>
                    <span className="text-[11px] font-mono text-muted-foreground tabular-nums">{coherenceRanking.filter(u => u.deviation !== null && u.deviation > 0).length}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground ml-[15px] mb-4">
                    Acima do preço ótimo. Com essa tarifa, há risco de não ter adesão pelo mercado e derrubar a ocupação real.
                  </p>

                  <div className="space-y-2">
                    {coherenceRanking.filter(u => u.deviation !== null && u.deviation > 0).map(unit => {
                      const isExpanded = expandedCoherenceUnits.has(unit.unitId)
                      return (
                        <div
                          key={unit.unitId}
                          className="rounded-xl border border-red-100/80 bg-card transition-all duration-200 hover:shadow-sm overflow-hidden"
                        >
                          {/* Collapsed Row */}
                          <div className="flex items-center gap-4 px-5 py-3.5">
                            <div className="flex-1 min-w-0">
                              <a
                                href={`https://beto.stays.com.br/i/apartment/${unit.unitId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[13px] font-semibold text-foreground truncate block hover:text-blue-600 transition-colors"
                                title={`Ver ${unit.unitName} na Stays`}
                              >
                                {unit.unitName}
                              </a>
                              <span className="text-[10px] text-muted-foreground/70 font-medium mt-0.5 block">{unit.praca}</span>
                            </div>

                            <div className="hidden sm:flex items-center gap-6 shrink-0">
                              <div className="text-right w-[90px]">
                                <p className="text-[9px] text-muted-foreground/60 uppercase font-medium tracking-wider leading-none mb-0.5">Ótimo</p>
                                <p className="text-[13px] font-mono font-bold text-blue-600 leading-tight">{formatCurrency(unit.optimalPrice)}</p>
                              </div>
                              <div className="text-right w-[90px]">
                                <p className="text-[9px] text-muted-foreground/60 uppercase font-medium tracking-wider leading-none mb-0.5">Tarifa</p>
                                <p className="text-[13px] font-mono font-medium text-foreground/80 leading-tight">{unit.currentAvgPrice > 0 ? formatCurrency(unit.currentAvgPrice) : "—"}</p>
                              </div>
                            </div>

                            <div className="shrink-0 w-[68px] flex justify-center">
                              <span className="inline-flex items-center justify-center text-[12px] font-mono font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200/60 min-w-[60px]">
                                {unit.deviation !== null ? `+${unit.deviation.toFixed(0)}%` : "—"}
                              </span>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0 h-8 px-3 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg gap-1.5 transition-colors"
                              onClick={() => {
                                setExpandedCoherenceUnits(prev => {
                                  const next = new Set(prev)
                                  if (next.has(unit.unitId)) next.delete(unit.unitId)
                                  else next.add(unit.unitId)
                                  return next
                                })
                              }}
                            >
                              {isExpanded ? (
                                <>Menos <ChevronDown className="h-3 w-3 rotate-180 transition-transform" /></>
                              ) : (
                                <>Detalhes <ChevronDown className="h-3 w-3 transition-transform" /></>
                              )}
                            </Button>
                          </div>

                          {/* Expanded Content */}
                          {isExpanded && (
                            <div className="border-t border-red-100/60 bg-red-50/20 px-5 py-5 animate-in fade-in slide-in-from-top-1 duration-200">
                              <div className="grid grid-cols-3 gap-3 mb-5">
                                <div className="bg-background rounded-lg border border-border/40 p-3.5">
                                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium mb-1">Ocupação Projetada</p>
                                  <p className="text-base font-semibold text-foreground tabular-nums">{unit.expectedNights} <span className="text-[11px] font-normal text-muted-foreground">noites</span></p>
                                </div>
                                <div className="bg-background rounded-lg border border-border/40 p-3.5">
                                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium mb-1">Fat. Projetado</p>
                                  <p className="text-base font-semibold text-foreground font-mono tabular-nums">{formatCurrency(unit.projectedRevenue)}</p>
                                </div>
                                <div className="bg-background rounded-lg border border-border/40 p-3.5">
                                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium mb-1">% do Consolidado Anual</p>
                                  <p className="text-base font-semibold text-blue-600 font-mono tabular-nums">{unit.revenueShare > 0 ? `${unit.revenueShare.toFixed(1)}%` : "—"}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                <div>{renderAvailabilityCalendar(unit.unitId)}</div>
                                <div>
                                  <CompetitorAnalysisCard
                                    unitId={unit.unitId}
                                    unitName={unit.unitName}
                                    currentPrice={unit.currentAvgPrice}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Sem Tarifario */}
              {coherenceRanking.filter(u => u.deviation === null).length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="h-5 w-[3px] rounded-full bg-slate-300"></div>
                    <h3 className="text-[13px] font-semibold text-foreground tracking-tight">Sem Tarifa Cadastrada</h3>
                    <span className="text-[11px] font-mono text-muted-foreground tabular-nums">{coherenceRanking.filter(u => u.deviation === null).length}</span>
                  </div>

                  <div className="space-y-2 mt-3">
                    {coherenceRanking.filter(u => u.deviation === null).map(unit => (
                      <div
                        key={unit.unitId}
                        className="rounded-xl border border-border/40 bg-card/60 px-5 py-3.5 flex items-center gap-4 opacity-60"
                      >
                        <div className="flex-1 min-w-0">
                          <a
                            href={`https://beto.stays.com.br/i/apartment/${unit.unitId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] font-semibold text-foreground truncate block hover:text-blue-600 transition-colors"
                            title={`Ver ${unit.unitName} na Stays`}
                          >
                            {unit.unitName}
                          </a>
                          <span className="text-[10px] text-muted-foreground/70 font-medium mt-0.5 block">{unit.praca}</span>
                        </div>

                        <div className="hidden sm:flex items-center gap-6 shrink-0">
                          <div className="text-right w-[90px]">
                            <p className="text-[9px] text-muted-foreground/60 uppercase font-medium tracking-wider leading-none mb-0.5">Ótimo</p>
                            <p className="text-[13px] font-mono font-bold text-blue-600 leading-tight">{formatCurrency(unit.optimalPrice)}</p>
                          </div>
                          <div className="text-right w-[90px]">
                            <p className="text-[9px] text-muted-foreground/60 uppercase font-medium tracking-wider leading-none mb-0.5">Tarifa</p>
                            <p className="text-[13px] font-mono font-medium text-foreground/60 leading-tight">—</p>
                          </div>
                        </div>

                        <div className="shrink-0 w-[68px] flex justify-center">
                          <span className="text-[10px] text-muted-foreground italic">Sem tarifa</span>
                        </div>

                        {/* Empty spacer to align with rows that have buttons */}
                        <div className="shrink-0 w-[88px]"></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {coherenceRanking.length === 0 && (
                <div className="text-center py-16 rounded-xl border border-dashed border-border/40 text-sm text-muted-foreground bg-muted/10">
                  Nenhuma unidade encontrada.
                </div>
              )}
            </div >
          </div >
        </DialogContent >
      </Dialog >

      {/* Property Detail Sheet */}
      < Sheet open={!!detailUnitId} onOpenChange={(open) => { if (!open) setDetailUnitId(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">{detailUnit?.propriedade.nomepropriedade || "—"}</SheetTitle>
            <SheetDescription className="text-xs">
              Análise detalhada e comparativo histórico
            </SheetDescription>
          </SheetHeader>

          {detailUnit && detailUnitPricing && (
            <div className="space-y-5 px-4 pb-6">
              {/* Section A: Unit Summary */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resumo da Unidade</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Praça</p>
                    <p className="text-sm font-medium">{detailUnit.propriedade.praca || "—"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Grupo</p>
                    <p className="text-sm font-medium">{detailUnit.propriedade.grupo_nome || "—"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Quartos</p>
                    <p className="text-sm font-medium">{detailUnit.propriedade._i_rooms || "—"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Máx. Hóspedes</p>
                    <p className="text-sm font-medium">{detailUnit.propriedade._i_maxguests || "—"}</p>
                  </div>
                </div>

                {/* Pricing cards */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Preço Ótimo</p>
                    <p className="text-lg font-bold text-blue-700 mt-0.5">{formatCurrency(detailUnitPricing.optimalPrice)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Tarifário Atual</p>
                    <p className="text-lg font-bold mt-0.5">
                      {detailUnitPricing.currentAvgPrice > 0 ? formatCurrency(detailUnitPricing.currentAvgPrice) : "—"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Delta</p>
                    <p className={`text-lg font-bold mt-0.5 ${detailUnitPricing.currentAvgPrice > 0
                      ? Math.abs(detailUnitPricing.priceDelta) < 10 ? "text-emerald-600" : "text-red-600"
                      : "text-muted-foreground"
                      }`}>
                      {detailUnitPricing.currentAvgPrice > 0
                        ? `${detailUnitPricing.priceDelta > 0 ? "+" : ""}${detailUnitPricing.priceDelta.toFixed(0)}%`
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg border">
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">Meta do Período</p>
                  <p className="text-lg font-bold mt-0.5">{formatCurrency(detailUnitPricing.periodGoal, true)}</p>
                  <p className="text-[10px] text-muted-foreground">{detailUnitPricing.expectedNights} noites esperadas</p>
                </div>
              </div>

              {/* Section B: Benchmarks (3 Pillars) */}
              <div className="border-t pt-4">
                <Tabs defaultValue="peer-group">
                  <TabsList className="bg-muted/50 w-full">
                    <TabsTrigger value="peer-group" className="text-[11px] flex-1">Peer Group</TabsTrigger>
                    <TabsTrigger value="historical" className="text-[11px] flex-1">Histórico</TabsTrigger>
                    <TabsTrigger value="market" className="text-[11px] flex-1">Mercado</TabsTrigger>
                  </TabsList>

                  {/* Pillar 1: Peer Group */}
                  <TabsContent value="peer-group" className="mt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Unidades Semelhantes
                      </h3>
                      <div className="flex gap-1.5">
                        <Badge
                          variant={peerMode === "seasonality" ? "default" : "outline"}
                          className="cursor-pointer text-[10px]"
                          onClick={() => setPeerMode("seasonality")}
                        >
                          Nível Máximo
                        </Badge>
                        <Badge
                          variant={peerMode === "grupo" ? "default" : "outline"}
                          className="cursor-pointer text-[10px]"
                          onClick={() => setPeerMode("grupo")}
                        >
                          Nível Médio
                        </Badge>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {peerMode === "seasonality"
                        ? detailUnit.propriedade._i_maxguests != null
                          ? `Tipologia ±1 hóspede (${Math.max(1, Math.floor(detailUnit.propriedade._i_maxguests) - 1)}–${Math.floor(detailUnit.propriedade._i_maxguests) + 1}) + mesmo grupo`
                          : `Mesmo grupo (tipologia indefinida)`
                        : `Tipologia ±1 hóspede + mesma praça, ou mesmo grupo`
                      }
                    </p>

                    <div className="max-h-[350px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead className="text-[10px]">Unidade</TableHead>
                            <TableHead className="text-[10px] text-right">Tarifário</TableHead>
                            <TableHead className="text-[10px] text-right">Vendido</TableHead>
                            <TableHead className="text-[10px] text-right">% Meta</TableHead>
                            <TableHead className="text-[10px] text-right">Ocupação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {peerAnalysis.map(peer => (
                            <TableRow key={peer.unitId} className={peer.isSelected ? "bg-blue-50" : ""}>
                              <TableCell className="text-sm max-w-[140px]">
                                <div className="truncate">
                                  <span className={peer.isSelected ? "font-bold" : "font-medium"}>{peer.unitName}</span>
                                  <span className="text-[10px] text-muted-foreground ml-1">
                                    ({peer.rooms}q {peer.maxGuests}h)
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-sm font-mono">
                                {peer.tarifarioTrabalhado > 0 ? formatCurrency(peer.tarifarioTrabalhado) : "—"}
                              </TableCell>
                              <TableCell className="text-right text-sm font-mono">
                                {peer.valorVendido > 0 ? formatCurrency(peer.valorVendido, true) : "—"}
                              </TableCell>
                              <TableCell className="text-right text-sm font-mono">
                                {peer.percentualMeta > 0 ? (
                                  <span className={peer.percentualMeta >= 100 ? "text-emerald-600" : peer.percentualMeta >= 60 ? "text-amber-600" : "text-red-600"}>
                                    {peer.percentualMeta.toFixed(0)}%
                                  </span>
                                ) : "—"}
                              </TableCell>
                              <TableCell className="text-right text-sm font-mono">
                                <span className={peer.occupancyPct >= 70 ? "text-emerald-600" : peer.occupancyPct >= 40 ? "text-amber-600" : "text-red-600"}>
                                  {peer.occupancyPct}%
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {peerAnalysis.length === 0 && (
                      <p className="text-center py-6 text-sm text-muted-foreground">Nenhum comparativo disponível.</p>
                    )}
                  </TabsContent>

                  {/* Pillar 2: Historical */}
                  <TabsContent value="historical" className="mt-3 space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Comparativo Ano Anterior
                    </h3>
                    {historicalComparison?.hasData ? (
                      <>
                        <p className="text-[10px] text-muted-foreground">
                          Período: {formatDateDDMM(historicalComparison.prevYearStart)} a {formatDateDDMM(historicalComparison.prevYearEnd)}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {/* Diária Média */}
                          <div className="p-3 rounded-lg border space-y-2">
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">Diária Média</p>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold">{formatCurrency(historicalComparison.current.diariaMedia)}</p>
                                {historicalComparison.current.reservas.length > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-1.5 text-[10px] text-blue-600 hover:text-blue-700"
                                    onClick={() => {
                                      const period = periods.find(p => p.id === selectedPeriodId)
                                      setReservasDialogData({
                                        reservas: historicalComparison.current.reservas,
                                        title: "Reservas - Período Atual",
                                        subtitle: period ? `${formatDateDDMM(period.startDate)} a ${formatDateDDMM(period.endDate)}` : ""
                                      })
                                    }}
                                  >
                                    Ver+
                                  </Button>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground">Atual</p>
                            </div>
                            <div className="border-t pt-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-muted-foreground">{historicalComparison.previous.diariaMedia > 0 ? formatCurrency(historicalComparison.previous.diariaMedia) : "—"}</p>
                                {historicalComparison.previous.reservas.length > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-1.5 text-[10px] text-blue-600 hover:text-blue-700"
                                    onClick={() => {
                                      setReservasDialogData({
                                        reservas: historicalComparison.previous.reservas,
                                        title: "Reservas - Ano Anterior",
                                        subtitle: `${formatDateDDMM(historicalComparison.prevYearStart)} a ${formatDateDDMM(historicalComparison.prevYearEnd)}`
                                      })
                                    }}
                                  >
                                    Ver+
                                  </Button>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground">Ano anterior</p>
                            </div>
                          </div>
                          {/* Valor Vendido */}
                          <div className="p-3 rounded-lg border space-y-2">
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">Vendido</p>
                            <div>
                              <p className="text-sm font-bold">{formatCurrency(historicalComparison.current.valorVendido, true)}</p>
                              <p className="text-[10px] text-muted-foreground">Atual</p>
                            </div>
                            <div className="border-t pt-1">
                              <p className="text-sm font-medium text-muted-foreground">{historicalComparison.previous.valorVendido > 0 ? formatCurrency(historicalComparison.previous.valorVendido, true) : "—"}</p>
                              <p className="text-[10px] text-muted-foreground">Ano anterior</p>
                            </div>
                          </div>
                          {/* % Meta */}
                          <div className="p-3 rounded-lg border space-y-2">
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">% Meta</p>
                            <div>
                              <p className={`text-sm font-bold ${historicalComparison.current.pctMeta >= 100 ? "text-emerald-600" : "text-red-600"}`}>
                                {historicalComparison.current.pctMeta.toFixed(1)}%
                              </p>
                              <p className="text-[10px] text-muted-foreground">Atual</p>
                            </div>
                            <div className="border-t pt-1">
                              <p className="text-sm font-medium text-muted-foreground">
                                {historicalComparison.previous.pctMeta > 0 ? `${historicalComparison.previous.pctMeta.toFixed(1)}%` : "—"}
                              </p>
                              <p className="text-[10px] text-muted-foreground">Ano anterior</p>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 gap-2 bg-muted/20 rounded-lg">
                        <Calendar className="h-8 w-8 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">Sem dados suficientes</p>
                        <p className="text-[10px] text-muted-foreground">Propriedade nova ou sem histórico no período anterior</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Pillar 3: Market (Competitors) */}
                  <TabsContent value="market" className="mt-3 space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Evolução de Preço — Concorrentes
                    </h3>
                    <CompetitorAnalysisCard
                      unitId={detailUnitId!}
                      unitName={detailUnit.propriedade.nomepropriedade}
                      currentPrice={detailUnitPricing?.currentAvgPrice || null}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Reservas Dialog */}
      <Dialog open={!!reservasDialogData} onOpenChange={() => setReservasDialogData(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{reservasDialogData?.title || "Reservas"}</DialogTitle>
            {reservasDialogData?.subtitle && (
              <p className="text-sm text-muted-foreground">{reservasDialogData.subtitle}</p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {reservasDialogData && reservasDialogData.reservas.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Checkout</TableHead>
                    <TableHead className="text-right">Preço/Noite</TableHead>
                    <TableHead className="text-right">Noites</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservasDialogData.reservas.map((reserva: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-sm">
                        {formatDateDDMM(reserva.checkoutdate)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(reserva.pricepernight || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {reserva.nightcount || 0}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {formatCurrency(reserva.reservetotal || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center py-8 text-sm text-muted-foreground">Nenhuma reserva encontrada</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Seasonality Editor Component ────────────────────────────────────────────

function SeasonalityEditor({
  seasonality, allPracas, assignedPracas, periods, onSave, onDelete, saving,
}: {
  seasonality: Seasonality
  allPracas: string[]
  assignedPracas: Map<string, Seasonality>
  periods: PricingPeriod[]
  onSave: (s: Seasonality) => Promise<void>
  onDelete: (id: string) => Promise<void>
  saving: boolean
}) {
  const [local, setLocal] = useState(seasonality)
  const [dirty, setDirty] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Reset when prop changes
  useEffect(() => { setLocal(seasonality); setDirty(false) }, [seasonality])

  // Only count month periods for the 100% year total (events are % of their parent month)
  const monthPeriodIds = new Set(periods.filter(p => p.type === "month").map(p => p.id))
  const totalPercent = local.periods
    .filter(p => monthPeriodIds.has(p.periodId))
    .reduce((sum, p) => sum + p.percent, 0)

  // Praças available for this seasonality: unassigned or already in this seasonality
  const availablePracas = allPracas.filter(p => {
    const assigned = assignedPracas.get(p)
    return !assigned || assigned.id === seasonality.id
  })

  function togglePraca(praca: string) {
    setLocal(prev => ({
      ...prev,
      pracas: prev.pracas.includes(praca) ? prev.pracas.filter(p => p !== praca) : [...prev.pracas, praca],
    }))
    setDirty(true)
  }

  function setPeriodPercent(periodId: string, percent: number) {
    setLocal(prev => {
      const existing = prev.periods.find(p => p.periodId === periodId)
      const newPeriods = existing
        ? prev.periods.map(p => p.periodId === periodId ? { ...p, percent } : p)
        : [...prev.periods, { periodId, percent }]
      return { ...prev, periods: newPeriods }
    })
    setDirty(true)
  }

  function toggleEvent(eventId: string) {
    setLocal(prev => {
      const existing = prev.periods.find(p => p.periodId === eventId)
      const newPeriods = existing
        ? prev.periods.filter(p => p.periodId !== eventId) // Remove = disable
        : [...prev.periods, { periodId: eventId, percent: 0 }] // Add = enable
      return { ...prev, periods: newPeriods }
    })
    setDirty(true)
  }

  const isValid = Math.abs(totalPercent - 100) < 1
  const assignedPracasList = local.pracas

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Collapsed header - always visible */}
      <button
        type="button"
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(prev => !prev)}
      >
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold truncate">{local.name}</h3>
            <Badge variant={isValid ? "secondary" : totalPercent > 100 ? "destructive" : "outline"} className="text-[10px] font-mono shrink-0">
              {totalPercent.toFixed(1)}%
            </Badge>
            {dirty && <Badge variant="secondary" className="text-[9px] shrink-0">Alterado</Badge>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Progress value={Math.min(totalPercent, 100)} className="h-1.5 w-24" />
            {assignedPracasList.length > 0 ? (
              <span className="text-[10px] text-muted-foreground truncate">
                {assignedPracasList.length} praça{assignedPracasList.length > 1 ? "s" : ""}: {assignedPracasList.slice(0, 3).join(", ")}{assignedPracasList.length > 3 ? ` +${assignedPracasList.length - 3}` : ""}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground italic">Sem praças</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          {dirty && (
            <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => onSave(local)} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Salvar
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600" onClick={() => onDelete(seasonality.id)} disabled={saving}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t">
          {/* Praças */}
          <div className="pt-3">
            <p className="text-xs text-muted-foreground mb-1.5">Praças</p>
            <div className="flex flex-wrap gap-1.5">
              {availablePracas.map(praca => (
                <Badge
                  key={praca}
                  variant={local.pracas.includes(praca) ? "default" : "outline"}
                  className="cursor-pointer text-[10px] transition-colors"
                  onClick={() => togglePraca(praca)}
                >
                  {praca}
                </Badge>
              ))}
              {availablePracas.length === 0 && <p className="text-[11px] text-muted-foreground">Todas as praças já foram atribuídas.</p>}
            </div>
          </div>

          {/* Period percentages organized by month */}
          <div>
            <div className="bg-blue-50 border border-blue-100 rounded-md p-2 mb-3">
              <p className="text-[11px] text-blue-900 leading-relaxed">
                <strong>Como funciona:</strong> Distribua 100% do ano entre os meses. Depois, distribua os 100% de cada mês entre o período normal e eventos.
                <br />
                <strong>Ex:</strong> Janeiro = 10% do ano. Réveillon (evento) = 30% daqueles 10% = <strong>3% do ano</strong>. Janeiro resto = 70% × 10% = <strong>7% do ano</strong>.
              </p>
            </div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">% por período</p>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2"
                  onClick={() => {
                    // Auto-distribute equally across all months, preserving event configs
                    const monthPeriods = periods.filter(p => p.type === "month")
                    const equalPercent = 100 / monthPeriods.length
                    const monthEntries = monthPeriods.map(p => ({ periodId: p.id, percent: equalPercent }))
                    setLocal(prev => {
                      // Keep existing event configurations
                      const eventEntries = prev.periods.filter(p => !monthPeriodIds.has(p.periodId))
                      return { ...prev, periods: [...monthEntries, ...eventEntries] }
                    })
                    setDirty(true)
                  }}
                >
                  Distribuir Igualmente
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2"
                  onClick={() => {
                    // Clear month percentages but keep event toggles
                    setLocal(prev => ({
                      ...prev,
                      periods: prev.periods.filter(p => !monthPeriodIds.has(p.periodId)),
                    }))
                    setDirty(true)
                  }}
                >
                  Limpar
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {periods.filter(p => p.type === "month").map(month => {
                const monthPercent = local.periods.find(p => p.periodId === month.id)?.percent ?? 0
                // Find events within this month
                const eventsInMonth = periods.filter(p => {
                  if (p.type !== "event") return false
                  const monthStart = new Date(month.startDate)
                  const monthEnd = new Date(month.endDate)
                  const eventStart = new Date(p.startDate)
                  const eventEnd = new Date(p.endDate)
                  return (eventStart >= monthStart && eventStart <= monthEnd) ||
                    (eventEnd >= monthStart && eventEnd <= monthEnd)
                })
                const eventsTotal = eventsInMonth.reduce((sum, e) => {
                  const ep = local.periods.find(p => p.periodId === e.id)
                  return sum + (ep?.percent ?? 0)
                }, 0)
                const monthNormalPercent = Math.max(0, 100 - eventsTotal)

                return (
                  <div key={month.id} className="border rounded-md p-3 space-y-2 bg-muted/30">
                    {/* Month header and percentage of year */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold">{month.name}</span>
                          <Badge variant="outline" className="text-[9px] font-mono">
                            {monthPercent.toFixed(1)}% do ano
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[monthPercent]}
                            min={0}
                            max={100}
                            step={0.5}
                            className="flex-1"
                            onValueChange={([v]) => setPeriodPercent(month.id, v)}
                          />
                          <Input
                            type="number"
                            className="h-7 w-20 text-right font-mono text-xs"
                            value={monthPercent.toFixed(1)}
                            min={0}
                            max={100}
                            step={0.5}
                            onChange={e => setPeriodPercent(month.id, Number(e.target.value) || 0)}
                          />
                          <span className="text-[10px] text-muted-foreground w-4">%</span>
                        </div>
                      </div>
                    </div>

                    {/* Events within this month - they "steal" % from the month's 100% */}
                    {eventsInMonth.length > 0 && (
                      <div className="pl-3 border-l-2 border-blue-200 space-y-1.5 bg-blue-50/30 p-2 rounded">
                        <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                          <p className="text-[10px] font-semibold text-blue-900">Distribuição interna do mês</p>
                          <Badge variant={eventsTotal <= 100 ? "secondary" : "destructive"} className="text-[9px] font-mono shrink-0">
                            Eventos: {eventsTotal.toFixed(1)}% | Normal: {monthNormalPercent.toFixed(1)}%
                          </Badge>
                        </div>
                        {eventsInMonth.map(event => {
                          const eventEntry = local.periods.find(p => p.periodId === event.id)
                          const isEnabled = eventEntry !== undefined
                          const eventPercent = eventEntry?.percent ?? 0
                          const eventOfYear = (monthPercent * eventPercent / 100)
                          return (
                            <div key={event.id} className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${isEnabled ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300"}`}
                                  onClick={() => toggleEvent(event.id)}
                                  title={isEnabled ? "Desativar evento" : "Ativar evento"}
                                >
                                  {isEnabled && <Star className="h-2.5 w-2.5 text-white fill-white" />}
                                </button>
                                <span className={`text-[11px] font-medium min-w-[60px] ${isEnabled ? "text-blue-900" : "text-gray-400 line-through"}`}>{event.name}</span>
                                {isEnabled ? (
                                  <>
                                    <Slider
                                      value={[eventPercent]}
                                      min={0}
                                      max={100}
                                      step={0.5}
                                      className="flex-1 min-w-[80px] max-w-[150px]"
                                      onValueChange={([v]) => setPeriodPercent(event.id, v)}
                                    />
                                    <Input
                                      type="number"
                                      className="h-6 w-16 text-right font-mono text-[11px] bg-white border-blue-300"
                                      value={eventPercent.toFixed(1)}
                                      min={0}
                                      max={100}
                                      step={0.5}
                                      onChange={e => setPeriodPercent(event.id, Number(e.target.value) || 0)}
                                    />
                                    <span className="text-[10px] text-muted-foreground shrink-0">% do mês</span>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-gray-400 italic">Evento não relevante</span>
                                )}
                              </div>
                              {isEnabled && (
                                <p className="text-[10px] text-muted-foreground italic pl-6">
                                  = {eventOfYear.toFixed(2)}% do ano ({monthPercent.toFixed(1)}% × {eventPercent.toFixed(1)}%)
                                </p>
                              )}
                            </div>
                          )
                        })}
                        <div className="pt-1 mt-2 border-t border-blue-200">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">Resto do mês (sem eventos):</span>
                            <span className="font-mono font-semibold">{monthNormalPercent.toFixed(1)}% do mês = {(monthPercent * monthNormalPercent / 100).toFixed(2)}% do ano</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
