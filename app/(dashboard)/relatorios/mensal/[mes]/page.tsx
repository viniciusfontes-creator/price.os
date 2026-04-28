"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { useViewContext } from "@/contexts/view-context"
import { calculatePropertyStatus } from "@/lib/calculations"

import { DashboardSkeleton } from "@/components/page-skeleton"
import { MonthlyReportHeader } from "@/components/reports/monthly-report-header"
import {
  MonthlyReportFilters,
  EMPTY_FILTERS,
  type ReportFilters,
} from "@/components/reports/monthly-report-filters"
import { MonthlyKpiGrid } from "@/components/reports/monthly-kpi-grid"
import { StatusDistribution } from "@/components/reports/status-distribution"
import { QuickWinsSection } from "@/components/reports/quick-wins-section"
import { GapsList } from "@/components/reports/gaps-list"
import { RankingsSection } from "@/components/reports/rankings-section"
import { PickupPaceChart } from "@/components/reports/pickup-pace-chart"
import { YoYComparison } from "@/components/reports/yoy-comparison"
import { DimensionTables } from "@/components/reports/dimension-tables"
import { OccupancyMatrixHeatmap } from "@/components/reports/occupancy-matrix-heatmap"
import { PropertyListTable } from "@/components/reports/property-list-table"
import { PropertyDetailModal } from "@/components/reports/property-detail-modal"

import type {
  MonthlyReportPayload,
  DimensionRow,
  RankRow,
} from "@/types"
import { getMonthName } from "@/lib/calculations"

interface ReportResponse {
  success: boolean
  data?: MonthlyReportPayload
  error?: string
  fetchTime?: number
}

const fetcher = async ([url, viewType]: [string, string | null]): Promise<ReportResponse> => {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "x-view-context": viewType || "overview",
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`HTTP ${res.status}: ${text || "request failed"}`)
  }
  return res.json()
}

function aggregateDimension(
  itens: MonthlyReportPayload["itensPropriedade"],
  dim: "praca" | "grupo_nome"
): DimensionRow[] {
  const map = new Map<string, DimensionRow>()
  for (const it of itens) {
    const key = (it as any)[dim] || "—"
    if (!map.has(key)) {
      map.set(key, {
        key,
        otb: 0,
        meta: 0,
        metaMovel: 0,
        gap: 0,
        pctMeta: 0,
        status: "E",
        nProps: 0,
        nReservas: 0,
        noites: 0,
      })
    }
    const r = map.get(key)!
    r.otb += it.otb
    r.meta += it.meta
    r.metaMovel += it.metaMovel
    r.nProps += 1
    r.nReservas += it.nReservas
    r.noites += it.noites
  }
  return Array.from(map.values())
    .map((r) => {
      r.gap = r.meta - r.otb
      r.pctMeta = r.meta > 0 ? (r.otb / r.meta) * 100 : 0
      r.status = calculatePropertyStatus(r.otb, r.meta, r.metaMovel)
      return r
    })
    .sort((a, b) => b.otb - a.otb)
}

function buildRankings(itens: MonthlyReportPayload["itensPropriedade"]): {
  topOTB: RankRow[]
  overMeta: RankRow[]
  emRisco: RankRow[]
} {
  const rows: RankRow[] = itens.map((it) => ({
    propertyId: it.propertyId,
    nome: it.nome,
    praca: it.praca,
    grupo_nome: it.grupo_nome,
    otb: it.otb,
    meta: it.meta,
    gap: it.meta - it.otb,
    pctMeta: it.pctMeta,
    status: it.status,
    nReservas: it.nReservas,
    ticketMedio: it.ticketMedio,
  }))
  return {
    topOTB: [...rows].sort((a, b) => b.otb - a.otb).slice(0, 10),
    overMeta: rows
      .filter((r) => r.meta > 0 && r.otb >= r.meta)
      .sort((a, b) => b.pctMeta - a.pctMeta)
      .slice(0, 10),
    emRisco: rows
      .filter((r) => r.meta > 0 && r.pctMeta < 50)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 10),
  }
}

export default function MonthlyReportPage() {
  const params = useParams<{ mes: string }>()
  const { currentView } = useViewContext()
  const mes = params?.mes
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)

  const swrKey = mes ? [`/api/reports/monthly/${mes}`, currentView ?? "overview"] : null
  const { data: response, error, isLoading, isValidating, mutate } = useSWR<ReportResponse>(
    swrKey,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 300_000,
      keepPreviousData: true,
      shouldRetryOnError: true,
      errorRetryCount: 3,
    }
  )

  const payload = response?.data

  const filtered = useMemo(() => {
    if (!payload) return null
    const matchesItem = (it: MonthlyReportPayload["itensPropriedade"][number]) => {
      if (filters.praca && it.praca !== filters.praca) return false
      if (filters.grupo && it.grupo_nome !== filters.grupo) return false
      if (filters.status && it.status !== filters.status) return false
      if (filters.canal && it.canalMaior !== filters.canal) return false
      return true
    }
    const itens = payload.itensPropriedade.filter(matchesItem)
    const idsAllowed = new Set(itens.map((i) => i.propertyId))

    const totalOtb = itens.reduce((s, it) => s + it.otb, 0)
    const totalMeta = itens.reduce((s, it) => s + it.meta, 0)
    const totalMetaMovel = itens.reduce((s, it) => s + it.metaMovel, 0)
    const totalReservas = itens.reduce((s, it) => s + it.nReservas, 0)
    const totalNoites = itens.reduce((s, it) => s + it.noites, 0)

    const ocupacao = payload.ocupacao.filter((r) => idsAllowed.has(r.propertyId))
    const noitesVendidas = ocupacao.reduce((s, r) => s + r.noitesVendidas, 0)
    const noitesDisponiveis = ocupacao.reduce((s, r) => s + r.noitesDisponiveis, 0)
    const ocupacaoOTB =
      ocupacao.length > 0 && payload.daysInMonth > 0
        ? (noitesVendidas / (ocupacao.length * payload.daysInMonth)) * 100
        : 0

    const adrOTB = totalNoites > 0 ? totalOtb / totalNoites : 0
    const ticketMedio = totalReservas > 0 ? totalOtb / totalReservas : 0

    const statusDist = { A: 0, B: 0, C: 0, D: 0, E: 0 }
    for (const it of itens) {
      if (it.meta > 0 || it.otb > 0) statusDist[it.status]++
    }

    const gaps = payload.gaps.filter((g) => idsAllowed.has(g.propertyId))
    const quickWins = payload.quickWins.filter((q) => idsAllowed.has(q.propertyId))

    return {
      itens,
      ocupacao,
      gaps,
      quickWins,
      kpis: {
        metaMensal: totalMeta,
        metaMovel: totalMetaMovel,
        otb: totalOtb,
        otbPct: totalMeta > 0 ? (totalOtb / totalMeta) * 100 : 0,
        adrOTB,
        ocupacaoOTB,
        ticketMedioOTB: ticketMedio,
        antecedenciaMedia: payload.kpis.antecedenciaMedia,
        totalReservasOTB: totalReservas,
        noitesVendidasOTB: noitesVendidas,
        noitesDisponiveis,
      },
      statusDistribution: statusDist,
      porPraca: aggregateDimension(itens, "praca"),
      porGrupo: aggregateDimension(itens, "grupo_nome"),
      porCanal: aggregateCanal(payload, idsAllowed, filters.canal),
      rankings: buildRankings(itens),
      yoy: filterYoY(payload.yoy, filters.praca),
    }
  }, [payload, filters])

  if (!mes) return null

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="font-semibold text-red-800">Erro ao carregar relatório</p>
        <p className="text-sm text-red-700 mt-1">{error.message || "Falha desconhecida"}</p>
        <button
          onClick={() => mutate()}
          className="mt-3 text-sm underline text-red-800 hover:text-red-900"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (isLoading || !payload || !filtered) {
    return <DashboardSkeleton />
  }

  const [yStr, mStr] = payload.mes.split("-")
  const monthLabel = `${getMonthName(Number.parseInt(mStr, 10))} ${yStr}`
  const baselineLabel = `${getMonthName(Number.parseInt(mStr, 10))} ${payload.pickup.baselineYear}`

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao Dashboard
      </Link>

      <MonthlyReportHeader
        mes={payload.mes}
        asOf={payload.asOf}
        monthHasStarted={payload.monthHasStarted}
        daysElapsed={payload.daysElapsed}
        daysRemaining={payload.daysRemaining}
        daysInMonth={payload.daysInMonth}
        isRefreshing={isValidating}
        onRefresh={() => mutate()}
      />

      <MonthlyReportFilters
        options={payload.filterOptions}
        value={filters}
        onChange={setFilters}
      />

      <MonthlyKpiGrid kpis={filtered.kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <StatusDistribution
            distribution={filtered.statusDistribution}
            onClickStatus={(s) =>
              setFilters((f) => ({ ...f, status: f.status === s ? null : s }))
            }
            activeStatus={filters.status}
          />
        </div>
        <div className="lg:col-span-2">
          <YoYComparison
            baselineLabel={baselineLabel}
            currentLabel={monthLabel}
            totalBaseline={filtered.yoy.mai2025Receita}
            totalCurrent={filtered.yoy.mai2026OTB}
            deltaPct={filtered.yoy.deltaPct}
            porPraca={filtered.yoy.porPraca}
          />
        </div>
      </div>

      <RankingsSection
        topOTB={filtered.rankings.topOTB}
        overMeta={filtered.rankings.overMeta}
        emRisco={filtered.rankings.emRisco}
        onSelectProperty={setSelectedPropertyId}
      />

      <QuickWinsSection wins={filtered.quickWins} onSelectProperty={setSelectedPropertyId} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OccupancyMatrixHeatmap
          rows={filtered.ocupacao}
          mes={payload.mes}
          daysInMonth={payload.daysInMonth}
        />
        <GapsList gaps={filtered.gaps} onSelectProperty={setSelectedPropertyId} />
      </div>

      <PickupPaceChart
        atual={payload.pickup.atual}
        baseline={payload.pickup.baseline}
        baselineYear={payload.pickup.baselineYear}
        asOfDate={payload.asOf}
      />

      <DimensionTables
        porPraca={filtered.porPraca}
        porGrupo={filtered.porGrupo}
        porCanal={filtered.porCanal}
      />

      <PropertyListTable itens={filtered.itens} onSelectProperty={setSelectedPropertyId} />

      <PropertyDetailModal
        propertyId={selectedPropertyId}
        payload={payload}
        onClose={() => setSelectedPropertyId(null)}
      />
    </div>
  )
}

function aggregateCanal(
  payload: MonthlyReportPayload,
  idsAllowed: Set<string>,
  canalFilter: string | null
): MonthlyReportPayload["porCanal"] {
  if (idsAllowed.size === payload.itensPropriedade.length && !canalFilter) {
    return canalFilter
      ? payload.porCanal.filter((c) => c.canal === canalFilter)
      : payload.porCanal
  }
  return canalFilter
    ? payload.porCanal.filter((c) => c.canal === canalFilter)
    : payload.porCanal
}

function filterYoY(yoy: MonthlyReportPayload["yoy"], pracaFilter: string | null): MonthlyReportPayload["yoy"] {
  if (!pracaFilter) return yoy
  const filtered = yoy.porPraca.filter((p) => p.praca === pracaFilter)
  const totalBaseline = filtered.reduce((s, p) => s + p.mai2025, 0)
  const totalCurrent = filtered.reduce((s, p) => s + p.mai2026OTB, 0)
  return {
    mai2025Receita: totalBaseline,
    mai2026OTB: totalCurrent,
    deltaPct: totalBaseline > 0 ? ((totalCurrent - totalBaseline) / totalBaseline) * 100 : 0,
    porPraca: filtered,
  }
}
