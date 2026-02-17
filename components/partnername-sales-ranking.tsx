"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Medal, Award } from "lucide-react"

interface PartnernameSalesRankingProps {
  data: any[]
}

interface PartnernameSales {
  partnername: string
  totalReservas: number
  quantidadeReservas: number
  ticketMedio: number
}

export function PartnernameSalesRanking({ data }: PartnernameSalesRankingProps) {
  const [rankings, setRankings] = useState<PartnernameSales[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonthYear, setCurrentMonthYear] = useState("")

  useEffect(() => {
    const loadRankings = () => {
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

        console.log("[v0] Partnername Ranking - Current month range:", currentMonthStart, "to", currentMonthEnd)
        console.log("[v0] Total data items:", data.length)

        const currentMonthReservas = data
          .filter((item) =>
            item.reservas.some(
              (reserva: any) => reserva.creationdate >= currentMonthStart && reserva.creationdate <= currentMonthEnd,
            ),
          )
          .flatMap((item: any) =>
            item.reservas
              .filter((reserva: any) => reserva.creationdate >= currentMonthStart && reserva.creationdate <= currentMonthEnd)
              .map((reserva: any) => ({ ...reserva, propriedade: item.propriedade })),
          )

        console.log("[v0] Current month reservas found:", currentMonthReservas.length)

        const partnerMap = new Map<string, PartnernameSales>()

        currentMonthReservas.forEach((reserva: any) => {
          if (!reserva.partnername) return

          const current = partnerMap.get(reserva.partnername) || {
            partnername: reserva.partnername,
            totalReservas: 0,
            quantidadeReservas: 0,
            ticketMedio: 0,
          }

          current.totalReservas += reserva.reservetotal || 0
          current.quantidadeReservas += 1

          partnerMap.set(reserva.partnername, current)
        })

        const rankingData = Array.from(partnerMap.values())
          .map((partner) => ({
            ...partner,
            ticketMedio: partner.quantidadeReservas > 0 ? partner.totalReservas / partner.quantidadeReservas : 0,
          }))
          .sort((a, b) => b.totalReservas - a.totalReservas)
          .slice(0, 5)

        console.log("[v0] Final ranking data:", rankingData)
        setRankings(rankingData)
      } catch (error) {
        console.error("Erro ao carregar ranking por partnername:", error)
      } finally {
        setLoading(false)
      }
    }

    loadRankings()
  }, [data])

  const getPositionIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-4 w-4 text-yellow-500" />
      case 1:
        return <Medal className="h-4 w-4 text-gray-400" />
      case 2:
        return <Award className="h-4 w-4 text-amber-600" />
      default:
        return (
          <span className="h-4 w-4 flex items-center justify-center text-xs font-bold text-muted-foreground">
            {index + 1}
          </span>
        )
    }
  }

  const getPositionBadge = (index: number) => {
    switch (index) {
      case 0:
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case 1:
        return "bg-gray-100 text-gray-800 border-gray-200"
      case 2:
        return "bg-amber-100 text-amber-800 border-amber-200"
      default:
        return "bg-blue-50 text-blue-700 border-blue-200"
    }
  }

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Ranking por Canal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-muted-foreground">Carregando...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Ranking por Canal - {currentMonthYear}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Top 5 canais que mais venderam em {currentMonthYear.toLowerCase()}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rankings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma venda registrada em {currentMonthYear.toLowerCase()}</p>
            </div>
          ) : (
            rankings.map((partner, index) => (
              <div
                key={partner.partnername}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center space-x-3">
                  {getPositionIcon(index)}
                  <div>
                    <p className="font-medium">{partner.partnername}</p>
                    <p className="text-sm text-muted-foreground">
                      {partner.quantidadeReservas} reserva{partner.quantidadeReservas !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className={getPositionBadge(index)}>
                    R$ {partner.totalReservas.toLocaleString("pt-BR")}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ticket: R$ {partner.ticketMedio.toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
