"use client"

import { useRouter } from "next/navigation"
import { Calendar, RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getMonthName } from "@/lib/calculations"

interface MonthlyReportHeaderProps {
  mes: string
  asOf: string
  monthHasStarted: boolean
  daysElapsed: number
  daysRemaining: number
  daysInMonth: number
  isRefreshing?: boolean
  onRefresh: () => void
}

function buildMonthOptions(centerMes: string): Array<{ value: string; label: string }> {
  const [yStr, mStr] = centerMes.split("-")
  const y = Number.parseInt(yStr, 10)
  const m = Number.parseInt(mStr, 10)
  const out: Array<{ value: string; label: string }> = []
  for (let i = -6; i <= 6; i++) {
    const d = new Date(Date.UTC(y, m - 1 + i, 1))
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    out.push({ value, label: `${getMonthName(d.getUTCMonth() + 1)} ${d.getUTCFullYear()}` })
  }
  return out
}

export function MonthlyReportHeader({
  mes,
  asOf,
  monthHasStarted,
  daysElapsed,
  daysRemaining,
  daysInMonth,
  isRefreshing,
  onRefresh,
}: MonthlyReportHeaderProps) {
  const router = useRouter()
  const [yearStr, monthStr] = mes.split("-")
  const monthName = getMonthName(Number.parseInt(monthStr, 10))
  const options = buildMonthOptions(mes)

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Relatório Mensal • {monthName} {yearStr}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Atualizado em {new Date(asOf).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}.
          {monthHasStarted ? (
            <>
              {" "}
              {daysElapsed} {daysElapsed === 1 ? "dia decorrido" : "dias decorridos"} de {daysInMonth} ·{" "}
              {daysRemaining} {daysRemaining === 1 ? "dia restante" : "dias restantes"}.
            </>
          ) : (
            <>
              {" "}
              <span className="font-medium text-amber-700">Mês ainda não iniciou</span> — análise totalmente forward-looking
              (OTB).
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {!monthHasStarted && (
          <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-800">
            Forward-looking
          </Badge>
        )}
        <Select value={mes} onValueChange={(v) => router.push(`/relatorios/mensal/${v}`)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isRefreshing} className="h-9 w-9 p-0">
          {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
