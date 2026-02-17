"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProgressBar } from "./progress-bar"
import type { UnidadeMetrica } from "@/types"
import { formatCurrency } from "@/lib/calculations"
import { MapPin } from "lucide-react"

interface UnidadeCardProps {
  unidade: UnidadeMetrica
  onClick?: () => void
}

export function UnidadeCard({ unidade, onClick }: UnidadeCardProps) {
  return (
    <Card
      className="hover:shadow-md transition-all duration-200 cursor-pointer border-gray-200 hover:border-gray-300"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-gray-900">{unidade.nomepropriedade}</CardTitle>
            <div className="flex items-center text-sm text-gray-600">
              <MapPin className="w-4 h-4 mr-1" />
              {unidade.praca}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{Math.round(unidade.percentualAtingimento)}%</div>
            <div className="text-xs text-gray-500">atingimento</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <ProgressBar value={unidade.realizado} max={unidade.meta} size="md" showLabel={false} />

        <div className="flex justify-between items-center text-sm">
          <div>
            <div className="text-gray-600">Realizado</div>
            <div className="font-semibold text-gray-900">{formatCurrency(unidade.realizado)}</div>
          </div>
          <div className="text-right">
            <div className="text-gray-600">Meta</div>
            <div className="font-semibold text-gray-900">{formatCurrency(unidade.meta)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
