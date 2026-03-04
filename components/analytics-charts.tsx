"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { LoadingSpinner } from "./loading-spinner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface ChartData {
  name: string
  value: number
  secondaryValue?: number
}

interface FilterOptions {
  xAxis: string
  yAxis: string
  secondaryYAxis: string
  dateField: "creationdate" | "checkoutdate" | "checkindate" | "none"
  startDate: string
  endDate: string
  showSecondaryAxis: boolean
}

interface GlobalFilters {
  grupo: string
  praca: string
  partnername: string
  status: string[]
  receita: { min: number; max: number }
  dateRange: { start: string; end: string }
}

interface AnalyticsChartsProps {
  data: any[]
  globalFilters: any
}

// Opções disponíveis para os eixos
const STRING_AXIS_OPTIONS = [
  { value: "partnername", label: "Partner Name" },
  { value: "agentname", label: "Agent Name" },
  { value: "grupo_nome", label: "Grupo" },
  { value: "praca", label: "Praça" },
  { value: "nomepropriedade", label: "Nome da Propriedade" },
]

const NUMBER_AXIS_OPTIONS = [
  { value: "reservetotal", label: "Receita Total" },
  { value: "guesttotalcount", label: "Total de Hóspedes" },
  { value: "nightcount", label: "Número de Noites" },
  { value: "pricepernight", label: "Preço por Noite" },
  { value: "dias_sem_vendas", label: "Dias sem Vendas" },
]

const DATE_FIELD_OPTIONS = [
  { value: "none", label: "Sem filtro de data" },
  { value: "creationdate", label: "Data de Criação" },
  { value: "checkoutdate", label: "Data de Check-out" },
  { value: "checkindate", label: "Data de Check-in" },
]


function PracaDetailModal({ isOpen, onClose, data }: { isOpen: boolean; onClose: () => void; data: any }) {
  if (!data) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        showCloseButton={false}
        className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] md:w-full p-0 gap-0 scrollbar-thin scrollbar-thumb-gray-300"
      >
        <DialogHeader className="px-6 py-4 sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b flex flex-row items-start justify-between">
          <div className="flex-1">
            <DialogTitle className="text-xl md:text-2xl font-bold break-words pr-8">
              Detalhamento por Unidade - {data.name}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Lista de unidades na praça com meta e realizado do mês atual
            </DialogDescription>
          </div>
          <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground ml-4 mt-1">
            <X className="h-5 w-5" />
            <span className="sr-only">Fechar</span>
          </DialogPrimitive.Close>
        </DialogHeader>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4">
            {data.unidadesList?.map((unidade: any, index: number) => {
              const percentual = unidade.meta > 0 ? (unidade.realizado / unidade.meta) * 100 : 0
              return (
                <div
                  key={index}
                  className={`p-4 rounded-xl border-2 transition-colors ${percentual >= 100 ? "bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30" : "bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30"}`}
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                    <h5 className="font-bold text-foreground text-base md:text-lg leading-tight break-words flex-1 min-w-0">
                      {unidade.nome}
                    </h5>
                    <span
                      className={`px-3 py-1 rounded-full text-xs md:text-sm font-black shrink-0 w-fit ${percentual >= 100 ? "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400" : "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400"}`}
                    >
                      {percentual.toFixed(1)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm md:text-base border-t border-gray-100 dark:border-gray-800 pt-3">
                    <div>
                      <p className="text-xs md:text-sm text-muted-foreground uppercase tracking-wider font-medium mb-1">Meta</p>
                      <p className="font-bold text-foreground">
                        R$ {unidade.meta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-muted-foreground uppercase tracking-wider font-medium mb-1">Realizado</p>
                      <p className="font-bold text-foreground">
                        R$ {unidade.realizado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            }) || <p className="text-center py-8 text-muted-foreground italic">Nenhuma unidade encontrada</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function AnalyticsCharts({ data, globalFilters }: AnalyticsChartsProps) {
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [statusData, setStatusData] = useState<any[]>([])
  const [metaVsRealizadoData, setMetaVsRealizadoData] = useState<any[]>([])
  const [anoComparacaoData, setAnoComparacaoData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDrillDownOpen, setIsDrillDownOpen] = useState(false)
  const [drillDownData, setDrillDownData] = useState<any>(null)
  const [filters, setFilters] = useState<FilterOptions>({
    xAxis: "partnername",
    yAxis: "reservetotal",
    secondaryYAxis: "guesttotalcount",
    dateField: "none",
    startDate: "",
    endDate: "",
    showSecondaryAxis: true,
  })

  useEffect(() => {
    if (data && data.length > 0) {
      setLoading(false)
      processChartData()
      processStatusData()
      processMetaVsRealizadoData()
      processAnoComparacaoData()
    }
  }, [data, filters, globalFilters])

  const isDateInRange = (dateString: string, startDate: string, endDate: string): boolean => {
    if (!dateString || !startDate || !endDate) return true

    const date = new Date(dateString)
    const start = new Date(startDate)
    const end = new Date(endDate)

    return date >= start && date <= end
  }

  const processChartData = () => {
    const { xAxis, yAxis, secondaryYAxis, dateField, startDate, endDate } = filters

    if (xAxis === "nomepropriedade" && yAxis === "dias_sem_vendas") {
      const hoje = new Date()
      const propriedadeData = new Map<string, { criacaoMaisAntiga: Date | null; pricepernight: number }>()

      let filteredCount = 0
      data.forEach((item) => {
        filteredCount++

        const nomePropriedade = item.propriedade.nomepropriedade
        let criacaoMaisAntiga: Date | null = null
        let totalPricePerNight = 0
        let countReservas = 0

        item.reservas.forEach((reserva: any) => {
          if (reserva.creationdate) {
            const dataCriacao = new Date(reserva.creationdate)
            if (!criacaoMaisAntiga || dataCriacao < criacaoMaisAntiga) {
              criacaoMaisAntiga = dataCriacao
            }
          }
          if (reserva.pricepernight) {
            totalPricePerNight += reserva.pricepernight
            countReservas++
          }
        })

        const precoMedio = countReservas > 0 ? totalPricePerNight / countReservas : 0

        propriedadeData.set(nomePropriedade, {
          criacaoMaisAntiga,
          pricepernight: precoMedio,
        })
      })

      const processedData = Array.from(propriedadeData.entries())
        .map(([nome, data]) => {
          const diasDesdeCreacao = data.criacaoMaisAntiga
            ? Math.floor((hoje.getTime() - data.criacaoMaisAntiga.getTime()) / (1000 * 60 * 60 * 24))
            : 0

          return {
            name: nome,
            value: diasDesdeCreacao,
            secondaryValue: data.pricepernight,
          }
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)

      setChartData(processedData)
      return
    }

    const dataMap = new Map<string, { primary: number; secondary: number }>()
    let processedReservas = 0
    let filteredOutReservas = 0

    data.forEach((item) => {
      item.reservas.forEach((reserva: any) => {
        processedReservas++

        if (dateField !== "none" && startDate && endDate) {
          const dateValue = reserva[dateField]
          if (!isDateInRange(dateValue, startDate, endDate)) {
            return
          }
        }

        let xValue: string
        if (["grupo_nome", "praca", "nomepropriedade"].includes(xAxis)) {
          xValue = item.propriedade[xAxis] || "Não informado"
        } else {
          xValue = reserva[xAxis] || "Não informado"
        }

        if (xAxis === "agentname" && (!xValue || xValue === "Não informado" || xValue.trim() === "")) {
          return
        }

        let primaryValue: number
        let secondaryValue: number

        if (["grupo_nome", "praca", "nomepropriedade"].includes(yAxis)) {
          primaryValue = 1
        } else {
          primaryValue = Number(reserva[yAxis]) || 0
        }

        if (["grupo_nome", "praca", "nomepropriedade"].includes(secondaryYAxis)) {
          secondaryValue = 1
        } else {
          secondaryValue = Number(reserva[secondaryYAxis]) || 0
        }

        const current = dataMap.get(xValue) || { primary: 0, secondary: 0 }
        dataMap.set(xValue, {
          primary: current.primary + primaryValue,
          secondary: current.secondary + secondaryValue,
        })
      })
    })

    const processedData = Array.from(dataMap.entries())
      .map(([name, values]) => ({
        name,
        value: values.primary,
        secondaryValue: values.secondary,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)

    setChartData(processedData)
  }

  const processStatusData = () => {
    const hoje = new Date()
    const anoMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    const inicioMesStr = inicioMes.toISOString().split("T")[0]
    const fimMesStr = fimMes.toISOString().split("T")[0]

    const statusCount = { A: 0, B: 0, C: 0, D: 0, E: 0 }

    data.forEach((item) => {

      const metaDoMes = item.metas
        .filter((meta: any) => meta.data_especifica && meta.data_especifica.startsWith(anoMes))
        .reduce((sum: number, meta: any) => sum + (meta.meta || 0), 0)

      const metaMovel = item.metas
        .filter((meta: any) => meta.data_especifica && meta.data_especifica.startsWith(anoMes))
        .reduce((sum: number, meta: any) => sum + (meta.meta_movel || 0), 0)

      const receitaMes = item.reservas
        .filter((r: any) => r.checkoutdate >= inicioMesStr && r.checkoutdate <= fimMesStr)
        .reduce((sum: number, r: any) => sum + r.reservetotal, 0)

      let status = "E"
      if (receitaMes >= 0.1) {
        if (metaDoMes > 0 && receitaMes / metaDoMes >= 1.0) {
          status = "A"
        } else if (metaMovel > 0) {
          const percentualMovel = receitaMes / metaMovel
          if (percentualMovel >= 0.9) status = "B"
          else if (percentualMovel >= 0.5) status = "C"
          else status = "D"
        }
      }

      statusCount[status as keyof typeof statusCount]++
    })

    const statusColors = {
      A: "#10b981", // green
      B: "#3b82f6", // blue
      C: "#f59e0b", // yellow
      D: "#f97316", // orange
      E: "#ef4444", // red
    }

    const statusLabels = {
      A: "Status A (≥100% Meta)",
      B: "Status B (≥90% Meta Móvel)",
      C: "Status C (≥50% Meta Móvel)",
      D: "Status D (<50% Meta Móvel)",
      E: "Status E (Zerada)",
    }

    const totalUnidades = Object.values(statusCount).reduce((sum, count) => sum + count, 0)

    const chartDataArray = Object.entries(statusCount)
      .filter(([_, count]) => count > 0)
      .map(([status, count]) => ({
        name: statusLabels[status as keyof typeof statusLabels],
        value: count,
        percentage: totalUnidades > 0 ? ((count / totalUnidades) * 100).toFixed(1) : "0",
        color: statusColors[status as keyof typeof statusColors],
      }))

    setStatusData(chartDataArray)
  }

  const processMetaVsRealizadoData = () => {
    const hoje = new Date()
    const anoMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    const inicioMesStr = inicioMes.toISOString().split("T")[0]
    const fimMesStr = fimMes.toISOString().split("T")[0]

    const pracaData = new Map()

    data.forEach((item) => {
      const praca = item.propriedade.praca || "Sem Praça"

      const metaDoMes = item.metas
        .filter((meta: any) => meta.data_especifica && meta.data_especifica.startsWith(anoMes))
        .reduce((sum: number, meta: any) => sum + (meta.meta || 0), 0)

      const realizado = item.reservas
        .filter((r: any) => r.checkoutdate >= inicioMesStr && r.checkoutdate <= fimMesStr)
        .reduce((sum: number, r: any) => sum + r.reservetotal, 0)

      const current = pracaData.get(praca) || { meta: 0, realizado: 0, unidades: 0, unidadesList: [] }
      current.unidadesList.push({
        nome: item.propriedade.nomepropriedade,
        meta: metaDoMes,
        realizado: realizado
      })

      pracaData.set(praca, {
        meta: current.meta + metaDoMes,
        realizado: current.realizado + realizado,
        unidades: current.unidades + 1,
        unidadesList: current.unidadesList
      })
    })

    const chartDataArray = Array.from(pracaData.entries())
      .map(([praca, values]) => ({
        name: praca,
        meta: values.meta,
        realizado: values.realizado,
        unidades: values.unidades,
        unidadesList: values.unidadesList.sort((a: any, b: any) => b.realizado - a.realizado)
      }))
      .sort((a, b) => b.realizado - a.realizado)
      .slice(0, 10)

    setMetaVsRealizadoData(chartDataArray)
  }

  const processAnoComparacaoData = () => {
    const hoje = new Date()
    const mesAtual = hoje.getMonth() + 1
    // Forçamos 2025 e 2024 conforme solicitado, ou usamos o ano atual e o anterior
    const anoAtual = hoje.getFullYear()
    const anoAnterior = 2024 // Fixo conforme solicitação ou lógica de negócio

    const grupoData = new Map()

    data.forEach((item) => {
      const grupo = item.propriedade.grupo_nome || "Sem Grupo"

      const receita2025 = item.reservas
        .filter((r: any) => {
          const checkoutDate = new Date(r.checkoutdate)
          return checkoutDate.getFullYear() === 2025 && checkoutDate.getMonth() + 1 === mesAtual
        })
        .reduce((sum: number, r: any) => sum + r.reservetotal, 0)

      const receita2024 = item.reservas
        .filter((r: any) => {
          const checkoutDate = new Date(r.checkoutdate)
          return checkoutDate.getFullYear() === 2024 && checkoutDate.getMonth() + 1 === mesAtual
        })
        .reduce((sum: number, r: any) => sum + r.reservetotal, 0)

      const current = grupoData.get(grupo) || { ano2025: 0, ano2024: 0, unidades: 0 }
      grupoData.set(grupo, {
        ano2025: current.ano2025 + receita2025,
        ano2024: current.ano2024 + receita2024,
        unidades: current.unidades + 1,
      })
    })

    const chartDataArray = Array.from(grupoData.entries())
      .map(([grupo, values]) => ({
        name: grupo,
        "2025": values.ano2025,
        "2024": values.ano2024,
        unidades: values.unidades,
      }))
      .sort((a, b) => b["2025"] - a["2025"])
      .slice(0, 10)

    setAnoComparacaoData(chartDataArray)
  }

  const formatValue = (value: number, field: string) => {
    if (field === "reservetotal") {
      return `R$ ${value.toLocaleString("pt-BR")}`
    }
    return value.toLocaleString("pt-BR")
  }

  const formatAxisValue = (value: number, field: string) => {
    if (field === "reservetotal") {
      return `R$ ${(value / 1000).toFixed(0)}k`
    }
    return value.toLocaleString("pt-BR")
  }

  if (loading) {
    return (
      <Card className="h-96">
        <CardContent className="flex items-center justify-center h-full">
          <LoadingSpinner />
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Nenhum dado disponível para análise</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6 md:gap-8">
        {/* Meta vs Realizado por Praça */}
        <Card className="shadow-sm border-gray-200/50 rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Meta vs Realizado por Praça</CardTitle>
            <CardDescription>Top 10 praças no mês atual</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metaVsRealizadoData} margin={{ top: 10, right: 10, left: 10, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    fontSize={9}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    tick={{ fontSize: 9 }}
                  />
                  <YAxis
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    fontSize={9}
                    tick={{ fontSize: 9 }}
                  />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-white p-3 border rounded-lg shadow-lg">
                            <p className="font-semibold">{label}</p>
                            <p className="text-blue-600">Meta: R$ {data.meta.toLocaleString("pt-BR")}</p>
                            <p className="text-green-600">Realizado: R$ {data.realizado.toLocaleString("pt-BR")}</p>
                            <p className="text-gray-600">{data.unidades} unidades</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar
                    dataKey="meta"
                    fill="#3b82f6"
                    name="Meta"
                    radius={[4, 4, 0, 0]}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={(data) => {
                      setDrillDownData(data)
                      setIsDrillDownOpen(true)
                    }}
                  />
                  <Bar
                    dataKey="realizado"
                    fill="#10b981"
                    name="Realizado"
                    radius={[4, 4, 0, 0]}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={(data) => {
                      setDrillDownData(data)
                      setIsDrillDownOpen(true)
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Comparação Ano Atual vs 2024 */}
        <Card className="shadow-sm border-gray-200/50 rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">2025 vs 2024</CardTitle>
            <CardDescription>Top 10 grupos no mês atual</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={anoComparacaoData} margin={{ top: 10, right: 10, left: 10, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    fontSize={9}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    tick={{ fontSize: 9 }}
                  />
                  <YAxis
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    fontSize={9}
                    tick={{ fontSize: 9 }}
                  />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-white p-3 border rounded-lg shadow-lg">
                            <p className="font-semibold">{label}</p>
                            <p className="text-green-600">2025: R$ {data["2025"]?.toLocaleString("pt-BR") || "0"}</p>
                            <p className="text-blue-600">2024: R$ {data["2024"]?.toLocaleString("pt-BR") || "0"}</p>
                            <p className="text-gray-600">{data.unidades} unidades</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar dataKey="2025" fill="#10b981" name="2025" />
                  <Bar dataKey="2024" fill="#3b82f6" name="2024" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* TOP 10 Units with most days without sales */}

      {/* Gráfico Personalizado Existente */}
      <Card className="border-0 shadow-none bg-white">
        <CardContent className="p-4 md:p-8">
          <div className="space-y-6 md:space-y-10">
            <div className="space-y-6">
              <h3 className="text-xl md:text-2xl font-semibold text-gray-900 tracking-tight">Configuração dos Eixos</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                <div className="space-y-4">
                  <label className="text-base font-medium text-gray-900">Eixo X (Categoria)</label>
                  <Select
                    value={filters.xAxis}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, xAxis: value }))}
                  >
                    <SelectTrigger className="h-12 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-gray-50/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-200">
                      {STRING_AXIS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="rounded-lg">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <label className="text-base font-medium text-gray-900">Eixo Y Primário</label>
                  <Select
                    value={filters.yAxis}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, yAxis: value }))}
                  >
                    <SelectTrigger className="h-12 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-gray-50/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-200">
                      {NUMBER_AXIS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="rounded-lg">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <label className="text-base font-medium text-gray-900">Eixo Y Secundário</label>
                  <Select
                    value={filters.secondaryYAxis}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, secondaryYAxis: value }))}
                  >
                    <SelectTrigger className="h-12 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-gray-50/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-200">
                      {NUMBER_AXIS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="rounded-lg">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Filtros de Data */}
            <div className="space-y-6">
              <h3 className="text-xl md:text-2xl font-semibold text-gray-900 tracking-tight">Filtro de Data</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                <div className="space-y-4">
                  <label className="text-base font-medium text-gray-900">Campo de Data</label>
                  <Select
                    value={filters.dateField}
                    onValueChange={(value: "creationdate" | "checkoutdate" | "checkindate" | "none") =>
                      setFilters((prev) => ({ ...prev, dateField: value }))
                    }
                  >
                    <SelectTrigger className="h-12 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-gray-50/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-200">
                      {DATE_FIELD_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="rounded-lg">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <label className="text-base font-medium text-gray-900">Data Inicial</label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                    disabled={filters.dateField === "none"}
                    className="h-12 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100/50 bg-gray-50/50"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-base font-medium text-gray-900">Data Final</label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                    disabled={filters.dateField === "none"}
                    className="h-12 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100/50 bg-gray-50/50"
                  />
                </div>
              </div>
            </div>

            {/* Toggle for secondary axis */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-6 bg-gray-50/50 rounded-2xl border border-gray-200/50 gap-4">
              <div className="space-y-2">
                <label className="text-lg font-medium text-gray-900">Mostrar Eixo Y Secundário</label>
                <p className="text-sm text-gray-600">Exibe uma segunda série de dados no gráfico</p>
              </div>
              <Switch
                checked={filters.showSecondaryAxis}
                onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, showSecondaryAxis: checked }))}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-gray-200/50 rounded-2xl">
        <CardHeader className="pb-6 px-4 md:px-8 pt-6 md:pt-8">
          <CardTitle className="text-lg md:text-2xl font-semibold tracking-tight">
            {NUMBER_AXIS_OPTIONS.find((opt) => opt.value === filters.yAxis)?.label} por{" "}
            {STRING_AXIS_OPTIONS.find((opt) => opt.value === filters.xAxis)?.label}
            {filters.showSecondaryAxis && (
              <span className="text-base md:text-lg font-normal text-blue-600 ml-2">
                + {NUMBER_AXIS_OPTIONS.find((opt) => opt.value === filters.secondaryYAxis)?.label}
              </span>
            )}
          </CardTitle>
          <CardDescription className="text-gray-600 text-sm md:text-base">
            Análise dinâmica dos dados integrados (top 10)
            {filters.dateField !== "none" && filters.startDate && filters.endDate && (
              <span className="ml-2">
                • {DATE_FIELD_OPTIONS.find((opt) => opt.value === filters.dateField)?.label}: {filters.startDate} a{" "}
                {filters.endDate}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 md:px-8 pb-6 md:pb-8">
          <ChartContainer
            config={{
              value: {
                label: NUMBER_AXIS_OPTIONS.find((opt) => opt.value === filters.yAxis)?.label || filters.yAxis,
                color: "hsl(210, 100%, 50%)",
              },
              secondaryValue: {
                label:
                  NUMBER_AXIS_OPTIONS.find((opt) => opt.value === filters.secondaryYAxis)?.label ||
                  filters.secondaryYAxis,
                color: "hsl(142, 76%, 36%)",
              },
            }}
            className="h-[400px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 120 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" horizontal={true} vertical={false} />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={120}
                  fontSize={10}
                  interval={0}
                  stroke="#6b7280"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  yAxisId="primary"
                  tickFormatter={(value) => formatAxisValue(value, filters.yAxis)}
                  stroke="#6b7280"
                  axisLine={false}
                  tickLine={false}
                  fontSize={10}
                  tick={{ fontSize: 10 }}
                />
                {filters.showSecondaryAxis && (
                  <YAxis
                    yAxisId="secondary"
                    orientation="right"
                    tickFormatter={(value) => formatAxisValue(value, filters.secondaryYAxis)}
                    stroke="#6b7280"
                    axisLine={false}
                    tickLine={false}
                    fontSize={10}
                    tick={{ fontSize: 10 }}
                  />
                )}
                <ChartTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-lg backdrop-blur-sm">
                          <p className="font-semibold text-gray-900 mb-3 text-base">{label}</p>
                          {payload.map((entry, index) => (
                            <p key={index} className="text-sm mb-1" style={{ color: entry.color }}>
                              <span className="font-medium">{entry.name}:</span>{" "}
                              {formatValue(
                                Number(entry.value),
                                entry.dataKey === "value" ? filters.yAxis : filters.secondaryYAxis,
                              )}
                            </p>
                          ))}
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar
                  yAxisId="primary"
                  dataKey="value"
                  fill="hsl(210, 100%, 50%)"
                  radius={[6, 6, 0, 0]}
                  className="hover:opacity-80 transition-all duration-200"
                />
                {filters.showSecondaryAxis && (
                  <Bar
                    yAxisId="secondary"
                    dataKey="secondaryValue"
                    fill="hsl(142, 76%, 36%)"
                    radius={[6, 6, 0, 0]}
                    className="hover:opacity-80 transition-all duration-200"
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <PracaDetailModal
        isOpen={isDrillDownOpen}
        onClose={() => setIsDrillDownOpen(false)}
        data={drillDownData}
      />
    </div>
  )
}
