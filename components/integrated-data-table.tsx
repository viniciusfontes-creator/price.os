"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, TrendingUp, Users, Calendar, DollarSign, Database, Loader2, Eye } from "lucide-react"
import { formatCurrency, formatNumber } from "@/lib/calculations"
import { PropertyDetailsWidget } from "./property-details-widget"
import type { IntegratedData, GlobalFilters } from "@/types"

interface IntegratedDataTableProps {
  filters: GlobalFilters
}

export function IntegratedDataTable({ filters }: IntegratedDataTableProps) {
  const [data, setData] = useState<IntegratedData[]>([])
  const [filteredData, setFilteredData] = useState<IntegratedData[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [selectedProperty, setSelectedProperty] = useState<IntegratedData | null>(null)
  const [isWidgetOpen, setIsWidgetOpen] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const response = await fetch('/api/dashboard/data', { cache: 'no-store' })
        const result = await response.json()
        if (result.success && result.data) {
          setData(result.data)
        }
      } catch (error) {
        console.error("Erro ao carregar dados integrados:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const openPropertyDetails = (property: IntegratedData) => {
    setSelectedProperty(property)
    setIsWidgetOpen(true)
  }

  useEffect(() => {
    let filtered = [...data]

    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.propriedade.nomepropriedade.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.propriedade.idpropriedade.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (filters.grupos && filters.grupos.length > 0) {
      filtered = filtered.filter((item) => filters.grupos.includes(item.propriedade.grupo_nome))
    }

    if (filters.pracas && filters.pracas.length > 0) {
      filtered = filtered.filter((item) => filters.pracas.includes(item.propriedade.praca))
    }

    if (filters.partnernames && filters.partnernames.length > 0) {
      filtered = filtered.filter((item) =>
        item.reservas.some((reserva) => filters.partnernames.includes(reserva.partnername)),
      )
    }

    if (filters.receita && (filters.receita.min !== null || filters.receita.max !== null)) {
      filtered = filtered.filter((item) => {
        const receita = item.metricas.receitaTotal
        const min = filters.receita.min ?? 0
        const max = filters.receita.max ?? Number.MAX_VALUE
        return receita >= min && receita <= max
      })
    }

    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter((item) => filters.status.includes(item.metricas.status))
    }

    setFilteredData(filtered)
  }, [data, searchTerm, filters])

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Dados Integrados - Propriedades e Reservas
          </CardTitle>

          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou ID da propriedade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              <p className="text-muted-foreground mt-2">Carregando dados...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum dado encontrado</p>
              <p className="text-sm">
                Ajuste os filtros para ver mais resultados
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Propriedade</TableHead>
                    <TableHead>Praça</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead className="text-right">Reservas</TableHead>
                    <TableHead className="text-right">Receita Total</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                    <TableHead className="text-right">Hóspedes</TableHead>
                    <TableHead className="text-right">Diárias</TableHead>
                    <TableHead className="text-right">Preço/Noite</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => {
                    return (
                      <TableRow key={item.propriedade.idpropriedade}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.propriedade.nomepropriedade}</p>
                            <p className="text-xs text-muted-foreground">ID: {item.propriedade.idpropriedade}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.propriedade.praca}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{item.propriedade.grupo_nome}</p>
                            <p className="text-xs text-muted-foreground">{item.propriedade.sub_grupo}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Calendar className="h-3 w-3" />
                            {item.metricas.totalReservas}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <div className="flex items-center justify-end gap-1">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(item.metricas.receitaTotal)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.metricas.ticketMedio)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Users className="h-3 w-3" />
                            {formatNumber(item.metricas.hospedesTotais)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(item.metricas.diariasVendidas)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.metricas.precoMedioNoite)}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPropertyDetails(item)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedProperty && (
        <PropertyDetailsWidget
          property={selectedProperty}
          isOpen={isWidgetOpen}
          onClose={() => {
            setIsWidgetOpen(false)
            setSelectedProperty(null)
          }}
        />
      )}
    </>
  )
}
