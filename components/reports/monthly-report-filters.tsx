"use client"

import { Filter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface ReportFilters {
  praca: string | null
  grupo: string | null
  status: string | null
  canal: string | null
}

export const EMPTY_FILTERS: ReportFilters = {
  praca: null,
  grupo: null,
  status: null,
  canal: null,
}

interface MonthlyReportFiltersProps {
  options: { pracas: string[]; grupos: string[]; status: string[]; canais: string[] }
  value: ReportFilters
  onChange: (next: ReportFilters) => void
}

export function MonthlyReportFilters({ options, value, onChange }: MonthlyReportFiltersProps) {
  const activeCount = Object.values(value).filter(Boolean).length

  function update<K extends keyof ReportFilters>(key: K, v: ReportFilters[K]) {
    onChange({ ...value, [key]: v })
  }

  function clearAll() {
    onChange(EMPTY_FILTERS)
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filtros
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeCount}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 flex-1">
          <Select
            value={value.praca ?? "__all__"}
            onValueChange={(v) => update("praca", v === "__all__" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Praça" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as praças</SelectItem>
              {options.pracas.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={value.grupo ?? "__all__"}
            onValueChange={(v) => update("grupo", v === "__all__" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Grupo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os grupos</SelectItem>
              {options.grupos.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={value.status ?? "__all__"}
            onValueChange={(v) => update("status", v === "__all__" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os status</SelectItem>
              {options.status.map((s) => (
                <SelectItem key={s} value={s}>
                  Status {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={value.canal ?? "__all__"}
            onValueChange={(v) => update("canal", v === "__all__" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os canais</SelectItem>
              {options.canais.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1">
            <X className="h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>
    </Card>
  )
}
