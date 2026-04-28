"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Building2, Search, ExternalLink } from "lucide-react"
import { formatCurrency } from "@/lib/calculations"
import type { MonthlyReportPayload } from "@/types"

const STATUS_BADGE: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 border-emerald-200",
  B: "bg-blue-100 text-blue-700 border-blue-200",
  C: "bg-amber-100 text-amber-700 border-amber-200",
  D: "bg-orange-100 text-orange-700 border-orange-200",
  E: "bg-red-100 text-red-700 border-red-200",
}

interface PropertyListTableProps {
  itens: MonthlyReportPayload["itensPropriedade"]
  onSelectProperty?: (propertyId: string) => void
}

type SortKey = "nome" | "praca" | "meta" | "otb" | "pctMeta" | "noites" | "ticketMedio" | "adr" | "precoAtual"

export function PropertyListTable({ itens, onSelectProperty }: PropertyListTableProps) {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("otb")
  const [dir, setDir] = useState<"asc" | "desc">("desc")
  const [pageSize, setPageSize] = useState(20)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const base = q
      ? itens.filter(
          (it) =>
            it.nome.toLowerCase().includes(q) ||
            it.praca.toLowerCase().includes(q) ||
            it.grupo_nome.toLowerCase().includes(q)
        )
      : itens
    return [...base].sort((a, b) => {
      const va = a[sortKey] as any
      const vb = b[sortKey] as any
      if (typeof va === "number" && typeof vb === "number") return dir === "desc" ? vb - va : va - vb
      return dir === "desc" ? String(vb).localeCompare(String(va)) : String(va).localeCompare(String(vb))
    })
  }, [itens, search, sortKey, dir])

  const visible = filtered.slice(0, pageSize)

  function toggleSort(k: SortKey) {
    if (sortKey === k) setDir(dir === "desc" ? "asc" : "desc")
    else {
      setSortKey(k)
      setDir("desc")
    }
  }

  const th = (label: string, k: SortKey, align: "left" | "right" = "right") => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 select-none ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {label}
      {sortKey === k && <span className="ml-1 text-[9px]">{dir === "desc" ? "▼" : "▲"}</span>}
    </th>
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">Detalhamento por Unidade</CardTitle>
            <Badge variant="secondary">{filtered.length}</Badge>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, praça..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                {th("Unidade", "nome", "left")}
                {th("Praça", "praca", "left")}
                {th("Status", "pctMeta", "left")}
                {th("Meta", "meta")}
                {th("OTB", "otb")}
                {th("% Meta", "pctMeta")}
                {th("Noites", "noites")}
                {th("Ticket Médio", "ticketMedio")}
                {th("ADR", "adr")}
                {th("Preço Atual", "precoAtual")}
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-left">Canal</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((it) => {
                const stayUrl = it.sub_grupo
                  ? `https://beto.stays.com.br/i/apartment/${it.sub_grupo}`
                  : null
                return (
                  <tr
                    key={it.propertyId}
                    onClick={() => onSelectProperty?.(it.propertyId)}
                    className={`border-b transition-colors ${
                      onSelectProperty ? "cursor-pointer hover:bg-muted/50" : "hover:bg-muted/30"
                    }`}
                  >{/* clickable row */}
                    <td className="px-3 py-2 max-w-[220px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate" title={it.nome}>
                          {it.nome}
                        </span>
                        {stayUrl && (
                          <a
                            href={stayUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{it.grupo_nome}</p>
                    </td>
                    <td className="px-3 py-2 text-xs">{it.praca}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[it.status] || ""}`}>
                        {it.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(it.meta)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(it.otb)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className={it.pctMeta >= 100 ? "text-emerald-700 font-semibold" : ""}>
                        {it.pctMeta.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{it.noites}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(it.ticketMedio)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(it.adr)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(it.precoAtual)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{it.canalMaior || "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > pageSize && (
          <div className="mt-3 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setPageSize(pageSize + 20)}>
              Mostrar mais ({filtered.length - pageSize} restantes)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
