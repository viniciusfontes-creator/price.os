"use client"

import { useMemo } from "react"
import { InitialLoadingScreen, DashboardSkeleton } from "@/components/page-skeleton"
import { KeyMetricsPanel } from "@/components/key-metrics-panel"
import { BarChart3, Database, RefreshCw, Loader2 } from "lucide-react"
import { AnalyticsCharts } from "@/components/analytics-charts"
import { DailySalesRanking } from "@/components/daily-sales-ranking"
import { PartnernameSalesRanking } from "@/components/partnername-sales-ranking"
import { GeminiChat } from "@/components/gemini-chat"
import { FilterBar } from "@/components/filters/filter-bar"
import { useGlobalFilters } from "@/contexts/global-filters-context"
import { applyGlobalFilters, getFilterOptions } from "@/lib/filter-utils"
import { useDashboardData } from "@/contexts/dashboard-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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

      <GeminiChat />
    </div>
  )
}
