"use client"

import { useState } from "react"
import { X, User, Building2 } from "lucide-react"

interface SalesDetailModalProps {
  isOpen: boolean
  onClose: () => void
  type: "hoje" | "semana"
  data: any[]
}

interface AgentSalesData {
  agent: string
  totalReserva: number
  quantidadeReservas: number
  percentualCheckoutMes: number
}

interface PropertySalesData {
  nomepropriedade: string
  totalReserva: number
  quantidadeReservas: number
  percentualCheckoutMes: number
}

export function SalesDetailModal({ isOpen, onClose, type, data }: SalesDetailModalProps) {
  const [viewMode, setViewMode] = useState<"agent" | "property">("agent")

  if (!isOpen) return null

  const calculateAgentData = (): AgentSalesData[] => {
    const agentMap = new Map<string, { total: number; count: number; checkoutThisMonth: number }>()

    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    const inicioMesStr = inicioMes.toISOString().split("T")[0]
    const fimMesStr = fimMes.toISOString().split("T")[0]

    // Filtrar data baseado no tipo
    const targetDate =
      type === "hoje"
        ? hoje.toISOString().split("T")[0]
        : (() => {
            const inicioSemana = new Date()
            inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
            return inicioSemana.toISOString().split("T")[0]
          })()

    data.forEach((item) => {
      item.reservas.forEach((reserva: any) => {
        // Filtrar por data e partnername "Atendimento"
        const isTargetPeriod =
          type === "hoje" ? reserva.creationdate === targetDate : reserva.creationdate >= targetDate

        if (isTargetPeriod && reserva.partnername === "Atendimento" && reserva.agentname) {
          const agent = reserva.agentname

          if (!agentMap.has(agent)) {
            agentMap.set(agent, { total: 0, count: 0, checkoutThisMonth: 0 })
          }

          const agentData = agentMap.get(agent)!
          agentData.total += reserva.reservetotal
          agentData.count += 1

          // Verificar se checkout é neste mês
          if (reserva.checkoutdate >= inicioMesStr && reserva.checkoutdate <= fimMesStr) {
            agentData.checkoutThisMonth += reserva.reservetotal
          }
        }
      })
    })

    return Array.from(agentMap.entries())
      .map(([agent, data]) => ({
        agent,
        totalReserva: data.total,
        quantidadeReservas: data.count,
        percentualCheckoutMes: data.total > 0 ? (data.checkoutThisMonth / data.total) * 100 : 0,
      }))
      .sort((a, b) => b.totalReserva - a.totalReserva)
  }

  const calculatePropertyData = (): PropertySalesData[] => {
    const propertyMap = new Map<string, { total: number; count: number; checkoutThisMonth: number }>()

    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    const inicioMesStr = inicioMes.toISOString().split("T")[0]
    const fimMesStr = fimMes.toISOString().split("T")[0]

    // Filtrar data baseado no tipo
    const targetDate =
      type === "hoje"
        ? hoje.toISOString().split("T")[0]
        : (() => {
            const inicioSemana = new Date()
            inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
            return inicioSemana.toISOString().split("T")[0]
          })()

    data.forEach((item) => {
      const propertyName = item.propriedade.nomepropriedade

      if (!propertyMap.has(propertyName)) {
        propertyMap.set(propertyName, { total: 0, count: 0, checkoutThisMonth: 0 })
      }

      const propertyData = propertyMap.get(propertyName)!

      item.reservas.forEach((reserva: any) => {
        // Filtrar por data
        const isTargetPeriod =
          type === "hoje" ? reserva.creationdate === targetDate : reserva.creationdate >= targetDate

        if (isTargetPeriod) {
          propertyData.total += reserva.reservetotal
          propertyData.count += 1

          // Verificar se checkout é neste mês
          if (reserva.checkoutdate >= inicioMesStr && reserva.checkoutdate <= fimMesStr) {
            propertyData.checkoutThisMonth += reserva.reservetotal
          }
        }
      })
    })

    return Array.from(propertyMap.entries())
      .map(([nomepropriedade, data]) => ({
        nomepropriedade,
        totalReserva: data.total,
        quantidadeReservas: data.count,
        percentualCheckoutMes: data.total > 0 ? (data.checkoutThisMonth / data.total) * 100 : 0,
      }))
      .filter((item) => item.totalReserva > 0) // Só mostrar propriedades com vendas
      .sort((a, b) => b.totalReserva - a.totalReserva)
  }

  const agentData = calculateAgentData()
  const propertyData = calculatePropertyData()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-md" onClick={onClose} />

      <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 max-w-6xl w-full max-h-[80vh] overflow-y-auto">
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/20 rounded-2xl" />

        <div className="relative z-10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              Detalhamento - Vendido {type === "hoje" ? "Hoje" : "na Semana"}
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="flex space-x-2 mb-6">
            <button
              onClick={() => setViewMode("agent")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                viewMode === "agent"
                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <User className="h-4 w-4" />
              <span>Por Agente</span>
            </button>
            <button
              onClick={() => setViewMode("property")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                viewMode === "property"
                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>Por Propriedade</span>
            </button>
          </div>

          {viewMode === "agent" ? (
            <div>
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
                  <strong>Nota:</strong> Dados filtrados apenas para partnername "Atendimento" com agentes definidos.
                </p>
              </div>

              {agentData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left p-3 border-b font-semibold text-gray-700">Agente</th>
                        <th className="text-right p-3 border-b font-semibold text-gray-700">Total Reserva</th>
                        <th className="text-right p-3 border-b font-semibold text-gray-700">Qtd Reservas</th>
                        <th className="text-right p-3 border-b font-semibold text-gray-700">% Checkout Este Mês</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentData.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-3 border-b font-medium text-gray-900">{item.agent}</td>
                          <td className="p-3 border-b text-right font-semibold text-green-600">
                            R$ {item.totalReserva.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 border-b text-right text-gray-700">{item.quantidadeReservas}</td>
                          <td className="p-3 border-b text-right">
                            <span
                              className={`font-medium ${
                                item.percentualCheckoutMes >= 50 ? "text-green-600" : "text-orange-600"
                              }`}
                            >
                              {item.percentualCheckoutMes.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Nenhuma venda encontrada para agentes no período selecionado.
                </div>
              )}
            </div>
          ) : (
            <div>
              {propertyData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left p-3 border-b font-semibold text-gray-700">Propriedade</th>
                        <th className="text-right p-3 border-b font-semibold text-gray-700">Total Reserva</th>
                        <th className="text-right p-3 border-b font-semibold text-gray-700">Qtd Reservas</th>
                        <th className="text-right p-3 border-b font-semibold text-gray-700">% Checkout Este Mês</th>
                      </tr>
                    </thead>
                    <tbody>
                      {propertyData.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-3 border-b font-medium text-gray-900">{item.nomepropriedade}</td>
                          <td className="p-3 border-b text-right font-semibold text-green-600">
                            R$ {item.totalReserva.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 border-b text-right text-gray-700">{item.quantidadeReservas}</td>
                          <td className="p-3 border-b text-right">
                            <span
                              className={`font-medium ${
                                item.percentualCheckoutMes >= 50 ? "text-green-600" : "text-orange-600"
                              }`}
                            >
                              {item.percentualCheckoutMes.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Nenhuma venda encontrada para propriedades no período selecionado.
                </div>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            className="mt-6 w-full bg-blue-600/90 backdrop-blur-sm text-white py-3 px-4 rounded-xl hover:bg-blue-700/90 transition-all duration-200 font-medium shadow-lg"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
