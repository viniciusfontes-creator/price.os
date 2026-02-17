"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageSkeleton } from "@/components/page-skeleton"
import {
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Activity,
  Search
} from "lucide-react"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FilterBar } from "@/components/filters/filter-bar"
import { useGlobalFilters } from "@/contexts/global-filters-context"
import { applyGlobalFilters, getFilterOptions } from "@/lib/filter-utils"
import type { IntegratedData } from "@/types"
import { Input } from "@/components/ui/input"

interface UnitAlert {
  id: string
  name: string
  revenue: number
  target: number
  percentAchieved: number
  daysSinceLastSale: number
  salesLast7Days: number
  status: "on-track" | "at-risk" | "behind"
  priceStatus: "overpriced" | "underpriced" | "normal"
  priority: number // Higher is more critical
}

export default function CriticalAlertsPage() {
  const [loading, setLoading] = useState(true)
  const [rawData, setRawData] = useState<IntegratedData[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const { filters } = useGlobalFilters()

  const filteredData = useMemo(
    () => applyGlobalFilters(rawData, filters),
    [rawData, filters]
  )

  const filterOptions = useMemo(
    () => getFilterOptions(rawData),
    [rawData]
  )

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/dashboard/data', { cache: 'no-store' })
        const result = await response.json()
        if (result.success && result.data) {
          setRawData(result.data)
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const alerts = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return []

    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    const diasNoMes = fimMes.getDate()
    const diaAtual = hoje.getDate()
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    return filteredData.map((item) => {
      const target = item.salesGoals?.mvenda_mensal || 0
      const unitRevenue = item.reservas
        .filter((r) => {
          const creationDate = new Date(r.creationdate)
          return creationDate >= inicioMes && creationDate <= hoje
        })
        .reduce((sum, r) => sum + r.reservetotal, 0)

      const percentAchieved = target > 0 ? (unitRevenue / target) * 100 : 0
      const expectedPercent = (diaAtual / diasNoMes) * 100

      let status: "on-track" | "at-risk" | "behind" = "on-track"
      if (percentAchieved < expectedPercent * 0.7) status = "behind"
      else if (percentAchieved < expectedPercent * 0.9) status = "at-risk"

      const salesLast7Days = item.reservas.filter((r) => new Date(r.creationdate) >= sevenDaysAgo).length

      const lastSale = item.reservas
        .filter((r) => new Date(r.creationdate) <= hoje)
        .sort((a, b) => new Date(b.creationdate).getTime() - new Date(a.creationdate).getTime())[0]

      const daysSinceLastSale = lastSale
        ? Math.floor((hoje.getTime() - new Date(lastSale.creationdate).getTime()) / (1000 * 60 * 60 * 24))
        : 999

      let priceStatus: "overpriced" | "underpriced" | "normal" = "normal"
      if (daysSinceLastSale >= 7) priceStatus = "overpriced"
      else if (salesLast7Days >= 2) priceStatus = "underpriced"

      // Calculate priority score
      let priority = 0
      if (status === "behind") priority += 50
      if (status === "at-risk") priority += 20
      if (priceStatus === "overpriced") priority += 30
      if (priceStatus === "underpriced") priority += 10

      return {
        id: item.propriedade.idpropriedade,
        name: item.propriedade.nomepropriedade,
        revenue: unitRevenue,
        target,
        percentAchieved,
        daysSinceLastSale,
        salesLast7Days,
        status,
        priceStatus,
        priority
      }
    })
      .filter(u => u.priority > 0) // Only keeps units with some level of alert
      .filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.priority - a.priority)
  }, [filteredData, searchQuery])

  if (loading) {
    return <PageSkeleton variant="table" />
  }

  return (
    <div className="space-y-6">
      <FilterBar filterOptions={filterOptions} />

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Badge variant="destructive" className="px-2 py-0.5 animate-pulse">LIVE</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Alertas Críticos</h1>
        </div>
        <p className="text-muted-foreground italic">Detecção automática de anomalias e urgências operacionais.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-destructive/5 border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Críticos (Prioridade Máxima)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {alerts.filter(a => a.priority >= 80).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">unidades exigem ação imediata</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-warning" />
              Anomalias de Preço
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts.filter(a => a.priceStatus !== "normal").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">sobre ou subprecificadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Risco de Meta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts.filter(a => a.status === "behind").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">abaixo do ritmo de vendas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Feed de Urgências</CardTitle>
              <CardDescription>Unidades ordenadas por nível de criticidade</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar unidade..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Motivo do Alerta</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                    Nenhum alerta crítico detectado no momento.
                    <CheckCircle className="h-5 w-5 text-success inline ml-2" />
                  </TableCell>
                </TableRow>
              ) : (
                alerts.map((alert) => (
                  <TableRow key={alert.id} className={alert.priority >= 80 ? "bg-destructive/5" : ""}>
                    <TableCell>
                      <div className="font-medium">{alert.name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{alert.id}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={alert.priority >= 80 ? "destructive" : alert.priority >= 50 ? "warning" : "secondary"}>
                        {alert.priority >= 80 ? "CRÍTICO" : alert.priority >= 50 ? "ALTO" : "MÉDIO"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {alert.status === "behind" && (
                          <span className="text-xs text-destructive flex items-center gap-1 font-semibold">
                            <AlertCircle className="h-3 w-3" /> Faturamento {alert.percentAchieved.toFixed(1)}% da meta
                          </span>
                        )}
                        {alert.priceStatus === "overpriced" && (
                          <span className="text-xs text-destructive flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" /> {alert.daysSinceLastSale} dias sem venda (Sobreprecificada)
                          </span>
                        )}
                        {alert.priceStatus === "underpriced" && (
                          <span className="text-xs text-warning flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" /> Giro excessivo: {alert.salesLast7Days} vend/7d (Subprecificada)
                          </span>
                        )}
                        {alert.status === "at-risk" && (
                          <span className="text-xs text-warning flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Ritmo de vendas em desaceleração
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/pricing" className="flex items-center gap-2">
                          Simular Estratégia <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
