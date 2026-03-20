"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { TrendingUp, Target, DollarSign, Trophy, ExternalLink } from "lucide-react"
import { SalesDetailModal } from "./sales-detail-modal"

interface KeyMetrics {
  metaMesCreation: number
  percentualAtingidoMesCreation: number
  metaSemanaCreation: number
  percentualAtingidoSemanaCreation: number
  metaMesCheckout: number
  percentualAtingidoMesCheckout: number
  metaSemanaCheckout: number
  percentualAtingidoSemanaCheckout: number
}

interface MetaVenda {
  IdPropriedade: string
  mcriacao_semanal: number
  mvenda_mensal: number
}

interface MetricDetailModalProps {
  isOpen: boolean
  onClose: () => void
  type: "meta-mes-creation" | "meta-semana-creation" | "meta-mes-checkout" | "meta-semana-checkout"
  data: any
}

function MetricDetailModal({ isOpen, onClose, type, data }: MetricDetailModalProps) {
  const router = useRouter()
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null)
  if (!isOpen) return null

  const renderContent = () => {
    switch (type) {
      case "meta-mes-creation":
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-foreground">Meta do Mês - Data de Criação</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Lista de percentual atingido das unidades do maior para o menor
            </p>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {data?.unidades?.map((unidade: any, index: number) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-2 ${unidade.percentual >= 100 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                    }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <h5 className="font-semibold text-foreground">{unidade.nome}</h5>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-bold ${unidade.percentual >= 100 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                    >
                      {unidade.percentual.toFixed(1)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Meta:</p>
                      <p className="font-bold text-foreground">
                        R$ {unidade.meta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Realizado:</p>
                      <p className="font-bold text-foreground">
                        R$ {unidade.realizado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              )) || <p className="text-muted-foreground">Nenhum dado disponível</p>}
            </div>
          </div>
        )

      case "meta-semana-creation":
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-foreground">Meta da Semana - Data de Criação</h3>
            <div className="space-y-6">
              {/* Unidades que venderam mais de 1 vez */}
              <div>
                <h4 className="font-medium text-green-700 mb-3">
                  Unidades que venderam mais de 1 vez esta semana ({data?.maisDeUma?.length || 0})
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {data?.maisDeUma?.map((unidade: any, index: number) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200"
                    >
                      <span className="font-medium text-foreground">{unidade.nome}</span>
                      <span className="font-bold text-green-600">{unidade.vendas} vendas</span>
                    </div>
                  )) || <p className="text-muted-foreground text-sm">Nenhuma unidade</p>}
                </div>
              </div>

              {/* Unidades que venderam 1 vez */}
              <div>
                <h4 className="font-medium text-blue-700 mb-3">
                  Unidades que venderam 1 vez esta semana ({data?.umaVez?.length || 0})
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {data?.umaVez?.map((unidade: any, index: number) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200"
                    >
                      <span className="font-medium text-foreground">{unidade.nome}</span>
                      <span className="font-bold text-blue-600">1 venda</span>
                    </div>
                  )) || <p className="text-muted-foreground text-sm">Nenhuma unidade</p>}
                </div>
              </div>

              {/* Unidades que não venderam */}
              <div>
                <h4 className="font-medium text-red-700 mb-3">
                  Unidades que não venderam esta semana ({data?.naoVenderam?.length || 0})
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {data?.naoVenderam?.map((unidade: any, index: number) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200"
                    >
                      <span className="font-medium text-foreground">{unidade.nome}</span>
                      <span className="font-bold text-red-600">0 vendas</span>
                    </div>
                  )) || <p className="text-muted-foreground text-sm">Nenhuma unidade</p>}
                </div>
              </div>
            </div>
          </div>
        )

      case "meta-mes-checkout": {
        const filteredUnidades = activeStatusFilter
          ? data?.unidades?.filter((u: any) => u.status === activeStatusFilter)
          : data?.unidades
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-foreground">Meta do Mês - Data de Checkout</h3>
            <p className="text-sm text-muted-foreground mb-4">Clique em uma unidade para abrir a Central de Comando</p>

            {/* Status Count - Clickable Filters */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4 mb-6">
              {["A", "B", "C", "D", "E"].map((status) => {
                const count = data?.statusCount?.[status] || 0
                const isActive = activeStatusFilter === status
                const colors = {
                  A: "bg-green-100 border-green-200 text-green-700",
                  B: "bg-blue-100 border-blue-200 text-blue-700",
                  C: "bg-yellow-100 border-yellow-200 text-yellow-700",
                  D: "bg-orange-100 border-orange-200 text-orange-700",
                  E: "bg-red-100 border-red-200 text-red-700",
                }
                return (
                  <div
                    key={status}
                    onClick={() => setActiveStatusFilter(isActive ? null : status)}
                    className={`p-2 sm:p-4 rounded-lg border-2 cursor-pointer transition-all ${colors[status as keyof typeof colors]} ${isActive ? "ring-2 ring-primary ring-offset-1 scale-105" : "hover:scale-[1.02] opacity-80 hover:opacity-100"}`}
                  >
                    <p className="text-xs sm:text-sm font-medium">Status {status}</p>
                    <p className="text-lg sm:text-2xl font-bold">{count}</p>
                    <p className="text-[10px] sm:text-xs">unidades</p>
                  </div>
                )
              })}
            </div>

            {activeStatusFilter && (
              <button
                onClick={() => setActiveStatusFilter(null)}
                className="text-xs text-primary hover:underline mb-3 block"
              >
                Limpar filtro (mostrando {filteredUnidades?.length || 0} de {data?.unidades?.length || 0})
              </button>
            )}

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredUnidades?.map((unidade: any, index: number) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${unidade.percentual >= 100 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                    }`}
                  onClick={() => {
                    onClose()
                    router.push(`/inventory/availability?tab=command-center&propertyId=${unidade.idpropriedade}`)
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <h5 className="font-semibold text-foreground">{unidade.nome}</h5>
                      {unidade.sub_grupo && (
                        <a
                          href={`https://beto.stays.com.br/i/apartment/${unidade.sub_grupo}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${unidade.status === "A"
                          ? "bg-green-100 text-green-800"
                          : unidade.status === "B"
                            ? "bg-blue-100 text-blue-800"
                            : unidade.status === "C"
                              ? "bg-yellow-100 text-yellow-800"
                              : unidade.status === "D"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-red-100 text-red-800"
                          }`}
                      >
                        {unidade.status}
                      </span>
                      <span className="px-3 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-800">
                        {unidade.percentual.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Meta:</p>
                      <p className="font-bold text-foreground">
                        R$ {unidade.meta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Realizado:</p>
                      <p className="font-bold text-foreground">
                        R$ {unidade.realizado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              )) || <p className="text-muted-foreground">Nenhum dado disponível</p>}
            </div>
          </div>
        )
      }

      case "meta-semana-checkout":
        return (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-foreground">Meta da Semana - Data de Checkout</h3>
            <div className="space-y-6">
              {/* Unidades com mais de 1 saída */}
              <div>
                <h4 className="font-medium text-green-700 mb-3">
                  Unidades com mais de 1 saída esta semana ({data?.maisDeUmaSaida?.length || 0})
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {data?.maisDeUmaSaida?.map((unidade: any, index: number) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200"
                    >
                      <span className="font-medium text-foreground">{unidade.nome}</span>
                      <span className="font-bold text-green-600">{unidade.saidas} saídas</span>
                    </div>
                  )) || <p className="text-muted-foreground text-sm">Nenhuma unidade</p>}
                </div>
              </div>

              {/* Unidades com 1 saída */}
              <div>
                <h4 className="font-medium text-blue-700 mb-3">
                  Unidades com 1 saída esta semana ({data?.umaSaida?.length || 0})
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {data?.umaSaida?.map((unidade: any, index: number) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200"
                    >
                      <span className="font-medium text-foreground">{unidade.nome}</span>
                      <span className="font-bold text-blue-600">1 saída</span>
                    </div>
                  )) || <p className="text-muted-foreground text-sm">Nenhuma unidade</p>}
                </div>
              </div>

              {/* Unidades sem saída */}
              <div>
                <h4 className="font-medium text-red-700 mb-3">
                  Unidades sem saída esta semana ({data?.semSaida?.length || 0})
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {data?.semSaida?.map((unidade: any, index: number) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200"
                    >
                      <span className="font-medium text-foreground">{unidade.nome}</span>
                      <span className="font-bold text-red-600">0 saídas</span>
                    </div>
                  )) || <p className="text-muted-foreground text-sm">Nenhuma unidade</p>}
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Detalhes em desenvolvimento</p>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="absolute inset-0 bg-gradient-to-br from-background/40 to-background/20 rounded-2xl" />
        <div className="relative z-10">
          {renderContent()}
          <button
            onClick={onClose}
            className="mt-6 w-full bg-primary text-primary-foreground py-3 px-4 rounded-xl hover:bg-primary/90 transition-all duration-200 font-medium shadow-lg"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

interface KeyMetricsPanelProps {
  data: any[]
}

export function KeyMetricsPanel({ data }: KeyMetricsPanelProps) {
  const [metrics, setMetrics] = useState<KeyMetrics>({
    metaMesCreation: 0,
    percentualAtingidoMesCreation: 0,
    metaSemanaCreation: 0,
    percentualAtingidoSemanaCreation: 0,
    metaMesCheckout: 0,
    percentualAtingidoMesCheckout: 0,
    metaSemanaCheckout: 0,
    percentualAtingidoSemanaCheckout: 0,
  })
  const [isUpdating, setIsUpdating] = useState(false)
  const [modalData, setModalData] = useState<any>(null)
  const [modalType, setModalType] = useState<
    "meta-mes-creation" | "meta-semana-creation" | "meta-mes-checkout" | "meta-semana-checkout"
  >("meta-mes-creation")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [salesModalOpen, setSalesModalOpen] = useState(false)
  const [salesModalType, setSalesModalType] = useState<"hoje" | "semana">("hoje")
  const [salesData, setSalesData] = useState<any[]>([])

  const calculateMetrics = () => {
    if (!data) return
    setIsUpdating(true)

    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    const inicioMesStr = inicioMes.toISOString().split("T")[0]
    const fimMesStr = fimMes.toISOString().split("T")[0]

    const inicioSemana = new Date()
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
    const inicioSemanaStr = inicioSemana.toISOString().split("T")[0]
    const fimSemanaStr = hoje.toISOString().split("T")[0]

    const metaTotalMesCreation = data.reduce((total, item) => total + (item.salesGoals?.mvenda_mensal || 0), 0)
    const metaTotalSemanaCreation = data.reduce((total, item) => total + (item.salesGoals?.mcriacao_semanal || 0), 0)

    const vendasMesCreation = data.reduce((total, item) => {
      const vendas = item.reservas
        .filter((r: any) => r.creationdate >= inicioMesStr && r.creationdate <= fimMesStr)
        .reduce((sum: number, r: any) => sum + r.reservetotal, 0)
      return total + vendas
    }, 0)

    const vendasSemanaCreation = data.reduce((total, item) => {
      const vendas = item.reservas
        .filter((r: any) => r.creationdate >= inicioSemanaStr && r.creationdate <= fimSemanaStr)
        .reduce((sum: number, r: any) => sum + r.reservetotal, 0)
      return total + vendas
    }, 0)

    const metaMesCheckout = data.reduce((total, item) => {
      const meta = item.metas
        ?.filter((m: any) => String(m.data_especifica || '').startsWith(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`))
        .reduce((sum: number, m: any) => sum + (m.meta || 0), 0) || 0
      return total + meta
    }, 0)

    const vendasMesCheckout = data.reduce((total, item) => {
      const vendas = item.reservas
        .filter((r: any) => r.checkoutdate >= inicioMesStr && r.checkoutdate <= fimMesStr)
        .reduce((sum: number, r: any) => sum + r.reservetotal, 0)
      return total + vendas
    }, 0)

    const metaSemanaCheckout = (metaMesCheckout / (fimMes.getDate() || 1)) * 7
    const vendasSemanaCheckout = data.reduce((total, item) => {
      const vendas = item.reservas
        .filter((r: any) => r.checkoutdate >= inicioSemanaStr && r.checkoutdate <= fimSemanaStr)
        .reduce((sum: number, r: any) => sum + r.reservetotal, 0)
      return total + vendas
    }, 0)

    setMetrics({
      metaMesCreation: metaTotalMesCreation,
      percentualAtingidoMesCreation: metaTotalMesCreation > 0 ? (vendasMesCreation / metaTotalMesCreation) * 100 : 0,
      metaSemanaCreation: metaTotalSemanaCreation,
      percentualAtingidoSemanaCreation: metaTotalSemanaCreation > 0 ? (vendasSemanaCreation / metaTotalSemanaCreation) * 100 : 0,
      metaMesCheckout,
      percentualAtingidoMesCheckout: metaMesCheckout > 0 ? (vendasMesCheckout / metaMesCheckout) * 100 : 0,
      metaSemanaCheckout,
      percentualAtingidoSemanaCheckout: metaSemanaCheckout > 0 ? (vendasSemanaCheckout / metaSemanaCheckout) * 100 : 0,
    })
    setSalesData(data)
    setIsUpdating(false)
  }

  const openMetricModal = (type: "meta-mes-creation" | "meta-semana-creation" | "meta-mes-checkout" | "meta-semana-checkout") => {
    const hoje = new Date()
    const inicioMesStr = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0]
    const fimMesStr = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split("T")[0]

    let mData = {}
    if (type === "meta-mes-creation") {
      const unidades = data
        .map(item => ({
          nome: item.propriedade.nomepropriedade,
          meta: item.salesGoals?.mvenda_mensal || 0,
          realizado: item.reservas
            .filter((r: any) => r.creationdate >= inicioMesStr && r.creationdate <= fimMesStr)
            .reduce((sum: number, r: any) => sum + r.reservetotal, 0),
          percentual: 0
        }))
        .map(u => ({ ...u, percentual: u.meta > 0 ? (u.realizado / u.meta) * 100 : 0 }))
        .filter(u => u.meta > 0)
        .sort((a, b) => b.percentual - a.percentual)
      mData = { unidades }
    } else if (type === "meta-semana-creation") {
      const inicioSemana = new Date()
      inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
      const inicioSemanaStr = inicioSemana.toISOString().split("T")[0]
      const hojeStr = hoje.toISOString().split("T")[0]

      const unidades = data.map(item => ({
        nome: item.propriedade.nomepropriedade,
        vendas: item.reservas.filter((r: any) => r.creationdate >= inicioSemanaStr && r.creationdate <= hojeStr).length
      }))

      mData = {
        maisDeUma: unidades.filter(u => u.vendas > 1).sort((a, b) => b.vendas - a.vendas),
        umaVez: unidades.filter(u => u.vendas === 1),
        naoVenderam: unidades.filter(u => u.vendas === 0).sort((a, b) => a.nome.localeCompare(b.nome))
      }
    } else if (type === "meta-mes-checkout") {
      const anoMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
      const statusCount = { A: 0, B: 0, C: 0, D: 0, E: 0 }

      const unidades = data
        .map(item => {
          const meta = item.metas
            ?.filter((m: any) => String(m.data_especifica || '').startsWith(anoMes))
            .reduce((sum: number, m: any) => sum + (m.meta || 0), 0) || 0

          const realizado = item.reservas
            .filter((r: any) => r.checkoutdate >= inicioMesStr && r.checkoutdate <= fimMesStr)
            .reduce((sum: number, r: any) => sum + r.reservetotal, 0)

          const percentual = meta > 0 ? (realizado / meta) * 100 : 0

          // Calculate status based on percentual (matching calculateMetrics logic in service)
          let status: "A" | "B" | "C" | "D" | "E" = "E"
          if (realizado > 0) {
            if (percentual >= 100) status = "A"
            else if (percentual >= 80) status = "B"
            else if (percentual >= 60) status = "C"
            else if (percentual >= 40) status = "D"
            else status = "E"
          }

          statusCount[status]++

          return {
            nome: item.propriedade.nomepropriedade,
            idpropriedade: item.propriedade.idpropriedade,
            sub_grupo: item.propriedade.sub_grupo,
            meta,
            realizado,
            percentual,
            status
          }
        })
        .filter(u => u.meta > 0)
        .sort((a, b) => b.percentual - a.percentual)

      mData = { unidades, statusCount }
    } else if (type === "meta-semana-checkout") {
      const inicioSemana = new Date()
      inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
      const inicioSemanaStr = inicioSemana.toISOString().split("T")[0]
      const hojeStr = hoje.toISOString().split("T")[0]

      const unidades = data.map(item => ({
        nome: item.propriedade.nomepropriedade,
        saidas: item.reservas.filter((r: any) => r.checkoutdate >= inicioSemanaStr && r.checkoutdate <= hojeStr).length
      }))

      mData = {
        maisDeUmaSaida: unidades.filter(u => u.saidas > 1).sort((a, b) => b.saidas - a.saidas),
        umaSaida: unidades.filter(u => u.saidas === 1),
        semSaida: unidades.filter(u => u.saidas === 0).sort((a, b) => a.nome.localeCompare(b.nome))
      }
    }
    setModalData(mData)
    setModalType(type)
    setIsModalOpen(true)
  }

  useEffect(() => {
    calculateMetrics()
  }, [data])

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-foreground">Métricas Principais</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 h-full">
        <div
          className={`bg-card rounded-xl shadow-sm border border-border p-6 transition-all duration-300 h-full flex flex-col justify-between ${isUpdating ? "animate-pulse" : ""}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">Meta do Mês</p>
              <p className="text-xs text-muted-foreground mb-1">(Data de Criação)</p>
              <p className="text-2xl font-bold text-foreground">
                R$ {metrics.metaMesCreation.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-muted-foreground">{metrics.percentualAtingidoMesCreation.toFixed(1)}% atingido</p>
            </div>
            <div className="flex flex-col items-end space-y-2">
              <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <button
                onClick={() => openMetricModal("meta-mes-creation")}
                className="w-6 h-6 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-full flex items-center justify-center transition-colors shadow-sm"
              >
                +
              </button>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(metrics.percentualAtingidoMesCreation, 100)}%` }}
            />
          </div>
        </div>

        <div
          className={`bg-card rounded-xl shadow-sm border border-border p-6 transition-all duration-300 h-full flex flex-col justify-between ${isUpdating ? "animate-pulse" : ""}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">Meta da Semana</p>
              <p className="text-xs text-muted-foreground mb-1">(Data de Criação)</p>
              <p className="text-2xl font-bold text-foreground">
                R$ {metrics.metaSemanaCreation.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-muted-foreground">{metrics.percentualAtingidoSemanaCreation.toFixed(1)}% atingido</p>
            </div>
            <div className="flex flex-col items-end space-y-2">
              <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <button
                onClick={() => openMetricModal("meta-semana-creation")}
                className="w-6 h-6 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-full flex items-center justify-center transition-colors shadow-sm"
              >
                +
              </button>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(metrics.percentualAtingidoSemanaCreation, 100)}%` }}
            />
          </div>
        </div>

        <div
          className={`bg-card rounded-xl shadow-sm border border-border p-6 transition-all duration-300 h-full flex flex-col justify-between ${isUpdating ? "animate-pulse" : ""}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">Meta do Mês</p>
              <p className="text-xs text-muted-foreground mb-1">(Data de Checkout)</p>
              <p className="text-2xl font-bold text-foreground">
                R$ {metrics.metaMesCheckout.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-muted-foreground">{metrics.percentualAtingidoMesCheckout.toFixed(1)}% atingido</p>
            </div>
            <div className="flex flex-col items-end space-y-2">
              <div className="h-12 w-12 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                <DollarSign className="h-6 w-6 text-slate-700 dark:text-slate-300" />
              </div>
              <button
                onClick={() => openMetricModal("meta-mes-checkout")}
                className="w-6 h-6 hover:bg-slate-700 text-white text-sm font-bold rounded-full flex items-center justify-center transition-colors shadow-sm bg-slate-800 dark:bg-slate-600"
              >
                +
              </button>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-gradient-to-r from-slate-500 to-slate-600 h-2 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(metrics.percentualAtingidoMesCheckout, 100)}%` }}
            />
          </div>
        </div>

        <div
          className={`bg-card rounded-xl shadow-sm border border-border p-6 transition-all duration-300 h-full flex flex-col justify-between ${isUpdating ? "animate-pulse" : ""}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">Meta da Semana</p>
              <p className="text-xs text-muted-foreground mb-1">(Data de Checkout)</p>
              <p className="text-2xl font-bold text-foreground">
                R$ {metrics.metaSemanaCheckout.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-muted-foreground">{metrics.percentualAtingidoSemanaCheckout.toFixed(1)}% atingido</p>
            </div>
            <div className="flex flex-col items-end space-y-2">
              <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Trophy className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <button
                onClick={() => openMetricModal("meta-semana-checkout")}
                className="w-6 h-6 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-full flex items-center justify-center transition-colors shadow-sm"
              >
                +
              </button>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(metrics.percentualAtingidoSemanaCheckout, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <MetricDetailModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} type={modalType} data={modalData} />

      <SalesDetailModal
        isOpen={salesModalOpen}
        onClose={() => setSalesModalOpen(false)}
        type={salesModalType}
        data={salesData}
      />
    </>
  )
}
