"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/loading-spinner"
import {
  CheckCircle,
  XCircle,
  Clock,
  Database,
  RefreshCw,
  AlertTriangle,
  Activity,
  Server,
  CloudCog,
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface SystemMetrics {
  lastSuccessfulSync: Date | null
  dataSource: "bigquery" | "mock" | "error"
  fetchTime: number
  totalProperties: number
  totalReservations: number
  totalMetas: number
}

interface LogEntry {
  id: string
  timestamp: Date
  type: "success" | "error" | "warning" | "info"
  message: string
  details?: string
}

export default function SystemPage() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<SystemMetrics>({
    lastSuccessfulSync: null,
    dataSource: "mock",
    fetchTime: 0,
    totalProperties: 0,
    totalReservations: 0,
    totalMetas: 0,
  })
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadSystemStatus = useCallback(async () => {
    try {
      setLoading(true)
      const startTime = Date.now()

      // Fetch data from BigQuery API
      const response = await fetch('/api/dashboard/data', {
        cache: 'no-store',
      })

      const result = await response.json()
      const fetchTime = Date.now() - startTime

      if (result.success) {
        const data = result.data || []
        const totalReservations = data.reduce((sum: number, item: { reservas?: unknown[] }) => sum + (item.reservas?.length || 0), 0)
        const totalMetas = data.reduce((sum: number, item: { metas?: unknown[] }) => sum + (item.metas?.length || 0), 0)

        setMetrics({
          lastSuccessfulSync: new Date(result.timestamp),
          dataSource: result.source as "bigquery" | "mock",
          fetchTime: result.fetchTime || fetchTime,
          totalProperties: result.count || 0,
          totalReservations: result.stats?.reservations || totalReservations,
          totalMetas: result.stats?.goals || totalMetas,
        })

        // Generate log entries
        const logEntries: LogEntry[] = [{
          id: "fetch-1",
          timestamp: new Date(),
          type: "success",
          message: `Dados carregados do ${result.source === 'bigquery' ? 'BigQuery' : 'Mock'}`,
          details: `${result.count} propriedades em ${result.fetchTime || fetchTime}ms`,
        }]

        if (result.stats) {
          logEntries.push({
            id: "stats-1",
            timestamp: new Date(),
            type: "info",
            message: "Estatísticas do BigQuery",
            details: `${result.stats.properties} props, ${result.stats.reservations} reservas, ${result.stats.goals} metas`,
          })
        }

        setLogs(logEntries)
      } else {
        setLogs([{
          id: "error-1",
          timestamp: new Date(),
          type: "error",
          message: "Erro ao carregar dados",
          details: result.error || "Erro desconhecido",
        }])
      }
    } catch (error) {
      console.error("Erro ao carregar status do sistema:", error)
      setLogs([{
        id: "error-1",
        timestamp: new Date(),
        type: "error",
        message: "Erro de conexão",
        details: String(error),
      }])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSystemStatus()
  }, [loadSystemStatus])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadSystemStatus()
    setIsRefreshing(false)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "bigquery":
        return <CheckCircle className="h-5 w-5 text-success" />
      case "error":
        return <XCircle className="h-5 w-5 text-destructive" />
      default:
        return <AlertTriangle className="h-5 w-5 text-warning" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "bigquery":
        return <Badge variant="default">BigQuery</Badge>
      case "error":
        return <Badge variant="destructive">Erro</Badge>
      default:
        return <Badge variant="secondary">Mock Data</Badge>
    }
  }

  const getLogIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-success" />
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-warning" />
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System</h1>
          <p className="text-muted-foreground">Data Health e Status do Sistema</p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Atualizando..." : "Atualizar"}
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Última Sincronização</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.lastSuccessfulSync
                ? metrics.lastSuccessfulSync.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
                : "Nunca"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.lastSuccessfulSync
                ? metrics.lastSuccessfulSync.toLocaleDateString("pt-BR")
                : "Carregue os dados"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fonte de Dados</CardTitle>
            <CloudCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getStatusIcon(metrics.dataSource)}
              {getStatusBadge(metrics.dataSource)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {metrics.dataSource === "bigquery"
                ? "Conectado ao Google BigQuery"
                : metrics.dataSource === "error"
                  ? "Verificar configuração"
                  : "Usando dados simulados"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tempo de Resposta</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.fetchTime < 1000
                ? `${metrics.fetchTime}ms`
                : `${(metrics.fetchTime / 1000).toFixed(1)}s`}
            </div>
            <Badge
              variant={
                metrics.fetchTime < 2000 ? "default" : metrics.fetchTime < 5000 ? "secondary" : "destructive"
              }
            >
              {metrics.fetchTime < 2000 ? "Rápido" : metrics.fetchTime < 5000 ? "Normal" : "Lento"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.dataSource !== "error" ? "100%" : "0%"}
            </div>
            <Badge variant={metrics.dataSource !== "error" ? "default" : "destructive"}>
              {metrics.dataSource !== "error" ? "Normal" : "Falha"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Data Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Resumo dos Dados
          </CardTitle>
          <CardDescription>Dados carregados do {metrics.dataSource === "bigquery" ? "BigQuery" : "sistema mock"}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Propriedades</p>
              <p className="text-3xl font-bold">{metrics.totalProperties.toLocaleString()}</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Reservas (90 dias)</p>
              <p className="text-3xl font-bold">{metrics.totalReservations.toLocaleString()}</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Metas do Mês</p>
              <p className="text-3xl font-bold">{metrics.totalMetas.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Logs do Sistema</CardTitle>
          <CardDescription>Últimas atividades e alertas</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Status</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length > 0 ? logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{getLogIcon(log.type)}</TableCell>
                  <TableCell className="text-sm">
                    <div>{log.timestamp.toLocaleDateString("pt-BR")}</div>
                    <div className="text-muted-foreground">
                      {log.timestamp.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{log.message}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{log.details || "-"}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum log disponível
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
