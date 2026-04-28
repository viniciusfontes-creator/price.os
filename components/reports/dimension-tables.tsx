"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Layers } from "lucide-react"
import type { DimensionRow } from "@/types"
import { formatCurrency } from "@/lib/calculations"

const STATUS_BADGE: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 border-emerald-200",
  B: "bg-blue-100 text-blue-700 border-blue-200",
  C: "bg-amber-100 text-amber-700 border-amber-200",
  D: "bg-orange-100 text-orange-700 border-orange-200",
  E: "bg-red-100 text-red-700 border-red-200",
}

interface DimensionTablesProps {
  porPraca: DimensionRow[]
  porGrupo: DimensionRow[]
  porCanal: Array<{ canal: string; receita: number; reservas: number; share: number }>
}

function DimensionTable({ rows, dimensionLabel }: { rows: DimensionRow[]; dimensionLabel: string }) {
  const [sortKey, setSortKey] = useState<keyof DimensionRow>("otb")
  const [dir, setDir] = useState<"asc" | "desc">("desc")

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const va = a[sortKey] as any
      const vb = b[sortKey] as any
      if (typeof va === "number") return dir === "desc" ? vb - va : va - vb
      return dir === "desc" ? String(vb).localeCompare(String(va)) : String(va).localeCompare(String(vb))
    })
  }, [rows, sortKey, dir])

  function toggleSort(k: keyof DimensionRow) {
    if (sortKey === k) {
      setDir(dir === "desc" ? "asc" : "desc")
    } else {
      setSortKey(k)
      setDir("desc")
    }
  }

  const headerCell = (label: string, k: keyof DimensionRow, align: "left" | "right" = "right") => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-3 py-2 text-xs font-medium cursor-pointer hover:bg-muted/50 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {label}
      {sortKey === k && <span className="ml-1 text-[9px]">{dir === "desc" ? "▼" : "▲"}</span>}
    </th>
  )

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Nenhum dado disponível.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b">
          <tr className="text-muted-foreground">
            {headerCell(dimensionLabel, "key", "left")}
            {headerCell("Meta", "meta")}
            {headerCell("OTB", "otb")}
            {headerCell("% Meta", "pctMeta")}
            {headerCell("Gap", "gap")}
            {headerCell("Status", "status", "left")}
            {headerCell("Unidades", "nProps")}
            {headerCell("Reservas", "nReservas")}
            {headerCell("Noites", "noites")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.key} className="border-b hover:bg-muted/30 transition-colors">
              <td className="px-3 py-2 text-left font-medium">{row.key}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.meta)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(row.otb)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span className={row.pctMeta >= 100 ? "text-emerald-700 font-semibold" : ""}>
                  {row.pctMeta.toFixed(0)}%
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span className={row.gap > 0 ? "text-red-700" : "text-emerald-700"}>
                  {formatCurrency(row.gap)}
                </span>
              </td>
              <td className="px-3 py-2">
                <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[row.status] || ""}`}>
                  {row.status}
                </Badge>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{row.nProps}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.nReservas}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.noites}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CanalTable({
  rows,
}: {
  rows: Array<{ canal: string; receita: number; reservas: number; share: number }>
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">Nenhum canal com vendas neste mês.</p>
  }
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.canal} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
          <div className="w-32 shrink-0">
            <p className="text-sm font-medium truncate" title={row.canal}>
              {row.canal}
            </p>
            <p className="text-[10px] text-muted-foreground">{row.reservas} reservas</p>
          </div>
          <div className="flex-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(row.share, 100)}%` }}
              />
            </div>
          </div>
          <div className="text-right shrink-0 w-32">
            <p className="text-sm font-bold tabular-nums">{formatCurrency(row.receita)}</p>
            <p className="text-[10px] text-muted-foreground tabular-nums">{row.share.toFixed(1)}%</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function DimensionTables({ porPraca, porGrupo, porCanal }: DimensionTablesProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-slate-600" />
          <CardTitle className="text-base">Performance por Dimensão</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="praca">
          <TabsList>
            <TabsTrigger value="praca">Por Praça</TabsTrigger>
            <TabsTrigger value="grupo">Por Grupo</TabsTrigger>
            <TabsTrigger value="canal">Por Canal</TabsTrigger>
          </TabsList>
          <TabsContent value="praca" className="mt-3">
            <DimensionTable rows={porPraca} dimensionLabel="Praça" />
          </TabsContent>
          <TabsContent value="grupo" className="mt-3">
            <DimensionTable rows={porGrupo} dimensionLabel="Grupo" />
          </TabsContent>
          <TabsContent value="canal" className="mt-3">
            <CanalTable rows={porCanal} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
