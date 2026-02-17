"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { InitialLoadingScreen, VendasSkeleton } from "@/components/page-skeleton"
import { useMemo } from "react"
import { useGlobalFilters } from "@/contexts/global-filters-context"
import { applyGlobalFilters, getFilterOptions } from "@/lib/filter-utils"
import { FilterBar } from "@/components/filters/filter-bar"
import { useDashboardData } from "@/contexts/dashboard-provider"
import { MessageSquare, Percent, DollarSign, TrendingUp, BarChart3, Database } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface SalesDemandMetrics {
  totalQuotes7Days: number
  totalQuotes30Days: number
  conversionRate: number
  revenuePerQuote: number
  searchInterestIndex: number
}

interface PartnerPerformance {
  name: string
  sales: number
  revenue: number
  avgTicket: number
  conversionRate: number
}

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

export default function SalesDemandPage() {
  // Use centralized dashboard data from SWR cache
  const { data: rawData, loading, source: dataSource, isFirstLoad } = useDashboardData()
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
  const [metrics, setMetrics] = useState<SalesDemandMetrics>({
    totalQuotes7Days: 0,
    totalQuotes30Days: 0,
    conversionRate: 0,
    revenuePerQuote: 0,
    searchInterestIndex: 0,
  })
  const [demandChartData, setDemandChartData] = useState<{ date: string; cotacoes: number; receita: number }[]>([])
  const [partnerData, setPartnerData] = useState<PartnerPerformance[]>([])
  const [originData, setOriginData] = useState<{ name: string; value: number }[]>([])

  useEffect(() => {
    if (!loading && filteredData) {
      const data = filteredData
      const hoje = new Date()
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      // Calculate sales metrics
      let totalSales7Days = 0
      let totalSales30Days = 0
      let totalRevenue7Days = 0
      let totalRevenue30Days = 0

      const partnerStats: Record<string, { sales: number; revenue: number }> = {}

      data.forEach((item) => {
        item.reservas.forEach((r) => {
          const creationDate = new Date(r.creationdate)

          if (creationDate >= thirtyDaysAgo) {
            totalSales30Days++
            totalRevenue30Days += r.reservetotal

            // Track by partner
            const partner = r.partnername || "Direto"
            if (!partnerStats[partner]) {
              partnerStats[partner] = { sales: 0, revenue: 0 }
            }
            partnerStats[partner].sales++
            partnerStats[partner].revenue += r.reservetotal

            if (creationDate >= sevenDaysAgo) {
              totalSales7Days++
              totalRevenue7Days += r.reservetotal
            }
          }
        })
      })

      // Simulate quotes
      const quotesMultiplier = 3.5
      const totalQuotes7Days = Math.round(totalSales7Days * quotesMultiplier)
      const totalQuotes30Days = Math.round(totalSales30Days * quotesMultiplier)
      const conversionRate = totalQuotes30Days > 0 ? (totalSales30Days / totalQuotes30Days) * 100 : 0
      const revenuePerQuote = totalQuotes30Days > 0 ? totalRevenue30Days / totalQuotes30Days : 0

      setMetrics({
        totalQuotes7Days,
        totalQuotes30Days,
        conversionRate,
        revenuePerQuote,
        searchInterestIndex: 85,
      })

      // Partner process
      const partnerArray: PartnerPerformance[] = Object.entries(partnerStats).map(([name, stats]) => ({
        name,
        sales: stats.sales,
        revenue: stats.revenue,
        avgTicket: stats.sales > 0 ? stats.revenue / stats.sales : 0,
        conversionRate: Math.round(25 + Math.random() * 15),
      }))
      partnerArray.sort((a, b) => b.revenue - a.revenue)
      setPartnerData(partnerArray)

      // Chart data
      const chartData = []
      for (let i = 29; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split("T")[0]
        const daySales = data.reduce((total, item) => {
          return total + item.reservas.filter((r) => r.creationdate === dateStr).reduce((sum, r) => sum + r.reservetotal, 0)
        }, 0)
        const dayQuotes = Math.round(daySales * quotesMultiplier * (0.8 + Math.random() * 0.4))
        chartData.push({
          date: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          cotacoes: Math.max(1, dayQuotes / 100),
          receita: daySales / 1000,
        })
      }
      setDemandChartData(chartData)

      // Origin data
      setOriginData([
        { name: "Booking.com", value: 35 },
        { name: "Airbnb", value: 28 },
        { name: "Site Direto", value: 20 },
        { name: "Expedia", value: 10 },
        { name: "Outros", value: 7 },
      ])
    }
  }, [filteredData, loading])

  // Show nice loading screen on first load
  if (isFirstLoad) {
    return <InitialLoadingScreen />
  }

  // Show skeleton if loading and we have no data
  if (loading && rawData.length === 0) {
    return <VendasSkeleton />
  }

  return (
    <div className="space-y-6">
      <FilterBar filterOptions={filterOptions} />

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Inteligência de Vendas</h1>
        <p className="text-muted-foreground italic">Pilar 4: Origem, conversão e funil de demanda de mercado.</p>
      </div>

      {/* Demand Funnel Visualization */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">Funil de Demanda Consolidado</CardTitle>
          <CardDescription>Visualização da jornada do cliente (Últimos 30 dias)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:gap-4">
            <div className="relative">
              <div className="h-10 sm:h-12 bg-primary/20 rounded-lg flex items-center px-3 sm:px-4 justify-between border border-primary/30">
                <span className="text-xs sm:text-sm font-semibold">Pesquisa / Interesse</span>
                <span className="font-bold">~{(metrics.totalQuotes30Days * 5).toLocaleString()} buscas</span>
              </div>
              <div className="h-8 sm:h-10 bg-primary/40 rounded-lg flex items-center px-3 sm:px-4 justify-between border border-primary/40 mt-1 mx-2 sm:mx-4">
                <span className="text-xs sm:text-sm font-semibold">Cotações</span>
                <span className="font-bold">{metrics.totalQuotes30Days.toLocaleString()}</span>
              </div>
              <div className="h-7 sm:h-8 bg-primary/60 rounded-lg flex items-center px-3 sm:px-4 justify-between border border-primary/50 mt-1 mx-4 sm:mx-8 text-primary-foreground">
                <span className="text-xs sm:text-sm font-semibold">Reservas</span>
                <span className="font-bold">{(metrics.totalQuotes30Days * metrics.conversionRate / 100).toFixed(0)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cotacoes (7/30 dias)</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalQuotes7Days}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.totalQuotes30Days} nos ultimos 30 dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversao</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.conversionRate.toFixed(1)}%</div>
            <Badge variant={metrics.conversionRate >= 25 ? "default" : "secondary"}>
              {metrics.conversionRate >= 25 ? "Bom" : "Melhorar"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receita por Cotacao</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {metrics.revenuePerQuote.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">valor medio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Indice de Interesse</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.searchInterestIndex}</div>
            <Badge variant={metrics.searchInterestIndex >= 80 ? "default" : "secondary"}>
              {metrics.searchInterestIndex >= 80 ? "Alto" : "Medio"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Demand vs Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Demanda vs Vendas</CardTitle>
            <CardDescription>Ultimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={demandChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" interval={4} />
                  <YAxis yAxisId="left" className="text-xs" />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" />
                  <Tooltip />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="cotacoes"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    name="Cotacoes (x100)"
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="receita"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    name="Receita (R$ mil)"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-chart-1" />
                <span className="text-sm">Cotacoes</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-chart-2" />
                <span className="text-sm">Receita</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Origin Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Origem das Vendas</CardTitle>
            <CardDescription>Distribuicao por canal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={originData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                  >
                    {originData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number | undefined) => [value !== undefined ? `${value}%` : "0%"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Partner Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance por Canal/Parceiro
          </CardTitle>
          <CardDescription>Ultimos 30 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="table">
            <TabsList>
              <TabsTrigger value="table">Tabela</TabsTrigger>
              <TabsTrigger value="chart">Grafico</TabsTrigger>
            </TabsList>

            <TabsContent value="table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal/Parceiro</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Ticket Medio</TableHead>
                    <TableHead className="text-right">Conversao</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partnerData.map((partner, index) => (
                    <TableRow key={partner.name}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          {partner.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{partner.sales}</TableCell>
                      <TableCell className="text-right">
                        R$ {partner.revenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {partner.avgTicket.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={partner.conversionRate >= 30 ? "default" : "secondary"}>
                          {partner.conversionRate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="chart">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={partnerData} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" className="text-xs" />
                    <Tooltip formatter={(value: number | undefined) => [value !== undefined ? `R$ ${value.toLocaleString("pt-BR")}` : "R$ 0"]} />
                    <Bar dataKey="revenue" name="Receita" radius={[0, 4, 4, 0]}>
                      {partnerData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
