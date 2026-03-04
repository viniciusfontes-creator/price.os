"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/loading-spinner"
import { ProgressBar } from "@/components/progress-bar"
import {
  calculateHistoricoMensal,
  calculateAntecedenciaMedia,
  formatCurrency,
  formatMesAnoDisplay,
} from "@/lib/calculations"
import type { WebhookPropriedade, WebhookReserva, HistoricoMensal, IntegratedData } from "@/types"
import { ArrowLeft, Calendar, Users, Clock, TrendingUp } from "lucide-react"

export default function UnidadeDetail() {
  const params = useParams()
  const router = useRouter()
  const [propriedade, setPropriedade] = useState<WebhookPropriedade | null>(null)
  const [historico, setHistorico] = useState<HistoricoMensal[]>([])
  const [reservasAtual, setReservasAtual] = useState<WebhookReserva[]>([])
  const [antecedenciaMedia, setAntecedenciaMedia] = useState(0)
  const [loading, setLoading] = useState(true)

  const idpropriedade = params.id as string
  const mesAtual = new Date()
  const mesAnoAtual = `${String(mesAtual.getMonth() + 1).padStart(2, "0")}-${mesAtual.getFullYear()}`

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)

        const response = await fetch('/api/dashboard/data', { cache: 'no-store' })
        const result = await response.json()

        if (!result.success || !result.data) {
          throw new Error("Falha ao carregar dados")
        }

        const data: IntegratedData[] = result.data
        const unitData = data.find((item) => item.propriedade.idpropriedade === idpropriedade)

        if (!unitData) {
          router.push("/")
          return
        }

        const prop = unitData.propriedade
        setPropriedade(prop)

        // Integrated data already has reservations and goals associated with the property
        // But the unit page historical calculation expects all reservations and goals to calculate trends
        // Or we can adapt calculateHistoricoMensal to take only current unit data

        // Reconstructing reservations for calculations if needed
        const allReservas: WebhookReserva[] = data.flatMap(d => d.reservas)
        const allMetas = data.flatMap(d => d.metas)

        const hist = calculateHistoricoMensal(idpropriedade, allReservas, allMetas)
        setHistorico(hist)

        const currentReservas = unitData.reservas.filter(
          (r) => {
            const checkout = new Date(r.checkoutdate)
            return `${String(checkout.getMonth() + 1).padStart(2, "0")}-${checkout.getFullYear()}` === mesAnoAtual
          }
        )
        setReservasAtual(currentReservas)

        const antecedencia = calculateAntecedenciaMedia(currentReservas)
        setAntecedenciaMedia(antecedencia)
      } catch (error) {
        console.error("Erro ao carregar dados da unidade:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [idpropriedade, mesAnoAtual, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-gray-600">Carregando detalhes da unidade...</p>
        </div>
      </div>
    )
  }

  if (!propriedade) {
    return null
  }

  const historicoAtual = historico.find((h) => h.mes_ano === mesAnoAtual)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.push("/")} className="mb-4 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{propriedade.nomepropriedade}</h1>
              <div className="flex items-center text-gray-600 space-x-4">
                <span>{propriedade.praca}</span>
                <span>•</span>
                <span>{propriedade.empreendimento_pousada}</span>
              </div>
            </div>

            {historicoAtual && (
              <div className="text-right">
                <div className="text-4xl font-bold text-gray-900">
                  {Math.round(historicoAtual.percentualAtingimento)}%
                </div>
                <div className="text-sm text-gray-600">{formatMesAnoDisplay(mesAnoAtual)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Métricas do Mês Atual */}
        {historicoAtual && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <TrendingUp className="w-8 h-8 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{formatCurrency(historicoAtual.realizado)}</div>
                    <div className="text-sm text-gray-600">Realizado</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-8 h-8 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{formatCurrency(historicoAtual.meta)}</div>
                    <div className="text-sm text-gray-600">Meta</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <Users className="w-8 h-8 text-purple-600" />
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{reservasAtual.length}</div>
                    <div className="text-sm text-gray-600">Reservas</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <Clock className="w-8 h-8 text-orange-600" />
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{antecedenciaMedia}</div>
                    <div className="text-sm text-gray-600">Dias médios</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Histórico Mensal */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {historico.map((item) => (
                  <div key={item.mes_ano} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">{formatMesAnoDisplay(item.mes_ano)}</span>
                      <span className="text-sm font-semibold text-gray-700">
                        {Math.round(item.percentualAtingimento)}%
                      </span>
                    </div>
                    <ProgressBar value={item.realizado} max={item.meta} size="sm" showLabel={true} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Reservas do Mês */}
          <Card>
            <CardHeader>
              <CardTitle>Reservas - {formatMesAnoDisplay(mesAnoAtual)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reservasAtual.length > 0 ? (
                  reservasAtual.map((reserva, index) => (
                    <div key={`${reserva.idpropriedade}-${index}`} className="border-l-4 border-blue-500 pl-4 py-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900">{reserva.partnername}</div>
                          <div className="text-sm text-gray-600">
                            {reserva.guesttotalcount} hóspede(s) • {reserva.nightcount} noite(s)
                          </div>
                          <div className="text-xs text-gray-500">
                            Check-out: {new Date(reserva.checkoutdate).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900">{formatCurrency(reserva.reservetotal)}</div>
                          <div className="text-xs text-gray-500">{reserva.antecedencia_reserva} dias antec.</div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600 text-center py-8">Nenhuma reserva encontrada para este mês.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
