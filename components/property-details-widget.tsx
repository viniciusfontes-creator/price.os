"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { TrendingUp, Target, DollarSign, AlertTriangle } from "lucide-react"
import type { IntegratedData } from "@/types"

interface PropertyDetailsWidgetProps {
  property: IntegratedData
  isOpen: boolean
  onClose: () => void
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "A":
      return "bg-green-500"
    case "B":
      return "bg-blue-500"
    case "C":
      return "bg-yellow-500"
    case "D":
      return "bg-orange-500"
    case "E":
      return "bg-red-500"
    default:
      return "bg-gray-500"
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case "A":
      return "Excelente (≥100% da meta)"
    case "B":
      return "Bom (≥90% da meta)"
    case "C":
      return "Regular (≥50% da meta)"
    case "D":
      return "Baixo (<50% da meta)"
    case "E":
      return "Sem receita"
    default:
      return "Indefinido"
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function PropertyDetailsWidget({ property, isOpen, onClose }: PropertyDetailsWidgetProps) {
  const [completedActions, setCompletedActions] = useState<string[]>([])
  const [historicalEvents, setHistoricalEvents] = useState([
    { date: "2024-12-15", type: "sale", description: "Venda realizada - R$ 1.200" },
    { date: "2024-12-10", type: "action", description: "Ação 'Verificar concorrência' marcada como concluída" },
    { date: "2024-12-05", type: "discount", description: "Desconto de 15% aplicado" },
    { date: "2024-12-01", type: "price", description: "Preço atualizado para R$ 180/noite" },
  ])

  const status = property.status || "E"
  const suggestedActions = [
    { id: "check-competition", text: "Verificar concorrência", icon: Target },
    { id: "adjust-price", text: "Ajustar preço", icon: DollarSign },
    { id: "improve-photos", text: "Melhorar fotos", icon: TrendingUp },
    { id: "update-description", text: "Atualizar descrição", icon: AlertTriangle },
  ]

  const toggleAction = (actionId: string, actionText: string) => {
    const isCompleted = completedActions.includes(actionId)

    if (!isCompleted) {
      const newEvent = {
        date: new Date().toISOString().split("T")[0],
        type: "action",
        description: `Ação '${actionText}' marcada como concluída`,
      }
      setHistoricalEvents((prev) => [newEvent, ...prev])
    }

    setCompletedActions((prev) =>
      prev.includes(actionId) ? prev.filter((id) => id !== actionId) : [...prev, actionId],
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-white/30 to-purple-50/50 backdrop-blur-sm rounded-lg" />

        <div className="relative z-10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
                <span>{property.propriedade.nomepropriedade}</span>
                <Badge variant="outline" className="ml-2">
                  Status {status} - {getStatusLabel(status)}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="performance" className="mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="actions">Ações Sugeridas</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="performance" className="space-y-4">
              <Card className="bg-white/60 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-lg">Métricas de Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Receita: R$ {property.receita?.toLocaleString() || "0"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">Meta: R$ {property.meta?.toLocaleString() || "0"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions" className="space-y-4">
              <Card className="bg-white/60 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-lg">Ações Recomendadas para Status {status}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {suggestedActions.map((action) => {
                    const Icon = action.icon
                    const isCompleted = completedActions.includes(action.id)

                    return (
                      <div
                        key={action.id}
                        className="flex items-center space-x-3 p-3 rounded-lg bg-white/40 backdrop-blur-sm"
                      >
                        <Checkbox
                          id={action.id}
                          checked={isCompleted}
                          onCheckedChange={() => toggleAction(action.id, action.text)}
                        />
                        <Icon className={`h-4 w-4 ${isCompleted ? "text-green-600" : "text-muted-foreground"}`} />
                        <label
                          htmlFor={action.id}
                          className={`flex-1 text-sm cursor-pointer ${
                            isCompleted ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {action.text}
                        </label>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <Card className="bg-white/60 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-lg">Histórico de Atividades</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {historicalEvents
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((event, index) => (
                        <div
                          key={index}
                          className="flex items-start space-x-3 p-3 rounded-lg bg-white/40 backdrop-blur-sm"
                        >
                          <div
                            className={`w-2 h-2 rounded-full mt-2 ${
                              event.type === "sale"
                                ? "bg-green-500"
                                : event.type === "action"
                                  ? "bg-blue-500"
                                  : event.type === "discount"
                                    ? "bg-yellow-500"
                                    : "bg-purple-500"
                            }`}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{event.description}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(event.date)}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
