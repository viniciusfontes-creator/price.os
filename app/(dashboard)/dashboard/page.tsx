"use client"

import Link from "next/link"
import { useMemo } from "react"
import { InitialLoadingScreen, DashboardSkeleton } from "@/components/page-skeleton"
import { KeyMetricsPanel } from "@/components/key-metrics-panel"
import { BarChart3, Database, RefreshCw, Loader2, FileBarChart, ArrowRight } from "lucide-react"
import { AnalyticsCharts } from "@/components/analytics-charts"
import { DailySalesRanking } from "@/components/daily-sales-ranking"
import { PartnernameSalesRanking } from "@/components/partnername-sales-ranking"
import { FilterBar } from "@/components/filters/filter-bar"
import { useGlobalFilters } from "@/contexts/global-filters-context"
import { applyGlobalFilters, getFilterOptions } from "@/lib/filter-utils"
import { useDashboardData } from "@/contexts/dashboard-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { OccupancyHeatmap } from "@/components/occupancy-heatmap"

export default function Dashboard() {
  const { data: rawData, loading, error, source, refetch, isFirstLoad, isValidating } = useDashboardData()
  const { filters } = useGlobalFilters()

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

  // Show nice loading screen on first load
  if (isFirstLoad) {
    return <InitialLoadingScreen />
  }

  // Show skeleton if loading and we have no data
  if (loading && rawData.length === 0) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Sistema de gerenciamento interno de precificação e performance da Qavi.
          </p>
        </div>

        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Data Source Badge */}
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <Badge variant={source === 'bigquery' ? 'default' : 'secondary'} className="text-xs sm:text-sm">
              {source === 'bigquery' ? 'BigQuery' : source === 'mock' ? 'Mock' : 'Local'}
              {isValidating && <Loader2 className="ml-1 h-3 w-3 animate-spin" />}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={refetch}
              disabled={isValidating}
              className="h-8 w-8 p-0"
              title={isValidating ? 'Atualizando...' : 'Atualizar dados'}
            >
              <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
          <p className="text-sm">
            <strong>Aviso:</strong> {error}. Usando dados de fallback.
          </p>
        </div>
      )}

      <Link
        href={`/relatorios/mensal/${(() => {
          const d = new Date()
          d.setMonth(d.getMonth() + (d.getDate() > 25 ? 1 : 0))
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        })()}`}
        className="group flex items-center gap-3 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-violet-50 p-4 transition-all hover:border-blue-300 hover:shadow-sm"
      >
        <div className="h-10 w-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
          <FileBarChart className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">Relatório Mensal Completo</p>
          <p className="text-xs text-muted-foreground">
            KPIs, status A-E, quick-wins acionáveis, ocupação prevista, comparativo YoY e ranking — tudo em uma página.
          </p>
        </div>
        <ArrowRight className="h-5 w-5 text-blue-600 transition-transform group-hover:translate-x-0.5" />
      </Link>

      {/* Global Filters */}
      <FilterBar filterOptions={filterOptions} />

      <KeyMetricsPanel data={filteredData} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailySalesRanking data={filteredData} />
        <PartnernameSalesRanking data={filteredData} />
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Análises</h2>
        </div>
        <AnalyticsCharts data={filteredData} globalFilters={filters} />
      </div>

      {/* Occupancy Heatmap */}
      {filteredData.length > 0 && (
        <OccupancyHeatmap
          properties={filteredData}
          title="Mapa de Ocupação"
        />
      )}
      
      {/* Onboarding / Ajuda da Página migrado para layout global */}
    </div>
  )
}
