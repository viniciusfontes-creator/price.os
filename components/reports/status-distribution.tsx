"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getStatusLabel } from "@/lib/calculations"

interface StatusDistributionProps {
  distribution: { A: number; B: number; C: number; D: number; E: number }
  total?: number
  onClickStatus?: (status: string) => void
  activeStatus?: string | null
}

const STATUS_META: Record<string, { bg: string; ring: string; text: string }> = {
  A: { bg: "bg-emerald-50 border-emerald-200", ring: "ring-emerald-300", text: "text-emerald-700" },
  B: { bg: "bg-blue-50 border-blue-200", ring: "ring-blue-300", text: "text-blue-700" },
  C: { bg: "bg-amber-50 border-amber-200", ring: "ring-amber-300", text: "text-amber-700" },
  D: { bg: "bg-orange-50 border-orange-200", ring: "ring-orange-300", text: "text-orange-700" },
  E: { bg: "bg-red-50 border-red-200", ring: "ring-red-300", text: "text-red-700" },
}

export function StatusDistribution({
  distribution,
  total,
  onClickStatus,
  activeStatus,
}: StatusDistributionProps) {
  const statuses: Array<keyof typeof distribution> = ["A", "B", "C", "D", "E"]
  const sum = total ?? statuses.reduce((s, k) => s + distribution[k], 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Distribuição por Status (A-E)</CardTitle>
        <p className="text-xs text-muted-foreground">
          A=≥100% Meta · B=≥80% Móvel · C=≥50% · D=&lt;50% · E=sem dados ou crítico
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {statuses.map((s) => {
            const count = distribution[s]
            const pct = sum > 0 ? (count / sum) * 100 : 0
            const meta = STATUS_META[s]
            const isActive = activeStatus === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => onClickStatus?.(s)}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-3 transition-all ${meta.bg} ${
                  isActive ? `ring-2 ring-offset-1 ${meta.ring}` : "hover:scale-[1.02]"
                } ${onClickStatus ? "cursor-pointer" : "cursor-default"}`}
              >
                <span className={`text-lg sm:text-2xl font-bold ${meta.text}`}>{count}</span>
                <span className={`text-xs font-semibold ${meta.text}`}>Status {s}</span>
                <span className="text-[10px] text-muted-foreground">{getStatusLabel(s)}</span>
                <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
