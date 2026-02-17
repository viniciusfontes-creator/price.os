"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, TrendingUp } from "lucide-react"
import type { GlobalFilters } from "@/types"

interface SalesAgent {
  agentname: string
  totalSales: number
  reserveCount: number
  rank: number
}

interface DailySalesRankingProps {
  data: any[]
}

export function DailySalesRanking({ data }: DailySalesRankingProps) {
  const [topAgents, setTopAgents] = useState<SalesAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonthYear, setCurrentMonthYear] = useState("")

  useEffect(() => {
    const loadRankingData = () => {
      try {
        setLoading(true)
        if (!data) return

        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1 // getMonth() retorna 0-11
        const monthStr = month.toString().padStart(2, "0")

        const currentMonthStart = `${year}-${monthStr}-01`
        const lastDay = new Date(year, month, 0).getDate()
        const currentMonthEnd = `${year}-${monthStr}-${lastDay.toString().padStart(2, "0")}`

        const monthNames = [
          "Janeiro",
          "Fevereiro",
          "Março",
          "Abril",
          "Maio",
          "Junho",
          "Julho",
          "Agosto",
          "Setembro",
          "Outubro",
          "Novembro",
          "Dezembro",
        ]
        setCurrentMonthYear(`${monthNames[month - 1]} ${year}`)

        console.log("[v0] Daily Sales Ranking - Current month range:", currentMonthStart, "to", currentMonthEnd)
        console.log("[v0] Total data items:", data.length)

        const currentMonthReserves = data.filter((item) => {
          const hasReserves = item.reservas && item.reservas.length > 0
          if (!hasReserves) return false

          return item.reservas.some((reserva) => {
            const isCurrentMonth = reserva.creationdate >= currentMonthStart && reserva.creationdate <= currentMonthEnd
            const isAtendimento = reserva.partnername === "Atendimento"
            const hasAgent = reserva.agentname && reserva.agentname.trim() !== ""

            if (isCurrentMonth && isAtendimento && hasAgent) {
              console.log("[v0] Found current month sale:", {
                property: item.propriedade?.nomepropriedade,
                agent: reserva.agentname,
                total: reserva.reservetotal,
                creationdate: reserva.creationdate,
              })
            }

            return isCurrentMonth && isAtendimento && hasAgent
          })
        })

        console.log("[v0] Properties with current month sales:", currentMonthReserves.length)

        const agentSales = new Map<string, { totalSales: number; reserveCount: number }>()

        currentMonthReserves.forEach((item) => {
          item.reservas?.forEach((reserva) => {
            const isCurrentMonth = reserva.creationdate >= currentMonthStart && reserva.creationdate <= currentMonthEnd
            const isAtendimento = reserva.partnername === "Atendimento"
            const hasAgent = reserva.agentname && reserva.agentname.trim() !== ""

            if (isCurrentMonth && isAtendimento && hasAgent) {
              const agentName = reserva.agentname
              const current = agentSales.get(agentName) || { totalSales: 0, reserveCount: 0 }

              agentSales.set(agentName, {
                totalSales: current.totalSales + (reserva.reservetotal || 0),
                reserveCount: current.reserveCount + 1,
              })
            }
          })
        })

        console.log("[v0] Agent sales map:", Array.from(agentSales.entries()))

        const sortedAgents = Array.from(agentSales.entries())
          .map(([agentname, data], index) => ({
            agentname,
            totalSales: data.totalSales,
            reserveCount: data.reserveCount,
            rank: index + 1,
          }))
          .sort((a, b) => b.totalSales - a.totalSales)
          .slice(0, 5) // Top 5
          .map((agent, index) => ({ ...agent, rank: index + 1 }))

        setTopAgents(sortedAgents)
      } catch (error) {
        console.error("Erro ao carregar ranking de vendas:", error)
      } finally {
        setLoading(false)
      }
    }

    loadRankingData()
  }, [data])

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />
    if (rank === 2) return <Trophy className="h-4 w-4 text-gray-400" />
    if (rank === 3) return <Trophy className="h-4 w-4 text-amber-600" />
    return <TrendingUp className="h-4 w-4 text-blue-500" />
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) return "bg-yellow-100 text-yellow-800 border-yellow-200"
    if (rank === 2) return "bg-gray-100 text-gray-800 border-gray-200"
    if (rank === 3) return "bg-amber-100 text-amber-800 border-amber-200"
    return "bg-blue-100 text-blue-800 border-blue-200"
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Ranking de Vendas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-gray-200 rounded"></div>
                  <div className="w-24 h-4 bg-gray-200 rounded"></div>
                </div>
                <div className="w-16 h-4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Ranking de Vendas - {currentMonthYear}
          <Badge variant="outline" className="ml-auto">
            Top 5 - Canal Atendimento
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {topAgents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma venda registrada em {currentMonthYear.toLowerCase()} no canal Atendimento</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topAgents.map((agent) => (
              <div
                key={agent.agentname}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Badge className={getRankBadge(agent.rank)}>#{agent.rank}</Badge>
                  {getRankIcon(agent.rank)}
                  <div>
                    <p className="font-medium">{agent.agentname}</p>
                    <p className="text-sm text-muted-foreground">
                      {agent.reserveCount} reserva{agent.reserveCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">R$ {agent.totalSales.toLocaleString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
