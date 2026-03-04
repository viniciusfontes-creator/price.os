"use client"

import { SalesIntelligenceSection } from "@/components/sales-intelligence-section"

export default function SalesDemandPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Inteligência de Vendas</h1>
        <p className="text-sm text-muted-foreground">
          Funil de conversão, demanda por destino e comportamento de compra.
        </p>
      </div>

      <SalesIntelligenceSection />
    </div>
  )
}
