"use client"

import { DollarSign, Target, TrendingUp, Calendar, Users, Bed, Hash, Activity } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/calculations"

interface KpiGridProps {
  kpis: {
    metaMensal: number
    otb: number
    otbPct: number
    adrOTB: number
    ocupacaoOTB: number
    ticketMedioOTB: number
    antecedenciaMedia: number
    totalReservasOTB: number
    noitesVendidasOTB: number
    noitesDisponiveis: number
  }
}

interface KpiCardProps {
  label: string
  value: string
  sublabel?: string
  icon: React.ElementType
  accent: "blue" | "green" | "amber" | "violet" | "slate"
  progress?: number
}

const ACCENT_MAP: Record<KpiCardProps["accent"], { bg: string; fg: string; bar: string }> = {
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    fg: "text-blue-600 dark:text-blue-400",
    bar: "from-blue-500 to-blue-600",
  },
  green: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    fg: "text-emerald-600 dark:text-emerald-400",
    bar: "from-emerald-500 to-emerald-600",
  },
  amber: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    fg: "text-amber-600 dark:text-amber-400",
    bar: "from-amber-500 to-amber-600",
  },
  violet: {
    bg: "bg-violet-100 dark:bg-violet-900/30",
    fg: "text-violet-600 dark:text-violet-400",
    bar: "from-violet-500 to-violet-600",
  },
  slate: {
    bg: "bg-slate-100 dark:bg-slate-800",
    fg: "text-slate-700 dark:text-slate-300",
    bar: "from-slate-500 to-slate-600",
  },
}

function KpiCard({ label, value, sublabel, icon: Icon, accent, progress }: KpiCardProps) {
  const colors = ACCENT_MAP[accent]
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6 flex flex-col justify-between gap-3 h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground truncate" title={value}>
              {value}
            </p>
            {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
          </div>
          <div className={`h-10 w-10 ${colors.bg} rounded-lg flex items-center justify-center shrink-0`}>
            <Icon className={`h-5 w-5 ${colors.fg}`} />
          </div>
        </div>
        {typeof progress === "number" && (
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className={`bg-gradient-to-r ${colors.bar} h-1.5 rounded-full transition-all duration-700 ease-out`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function MonthlyKpiGrid({ kpis }: KpiGridProps) {
  const totalNoites = kpis.noitesVendidasOTB + kpis.noitesDisponiveis
  const ocupacaoSubtitle = totalNoites > 0
    ? `${kpis.noitesVendidasOTB} de ${totalNoites} noites`
    : undefined

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="Meta do Mês"
        value={formatCurrency(kpis.metaMensal)}
        icon={Target}
        accent="blue"
      />
      <KpiCard
        label="OTB (Já Vendido)"
        value={formatCurrency(kpis.otb)}
        sublabel={`${kpis.otbPct.toFixed(1)}% da meta`}
        icon={DollarSign}
        accent="green"
        progress={kpis.otbPct}
      />
      <KpiCard
        label="Ocupação OTB"
        value={`${kpis.ocupacaoOTB.toFixed(1)}%`}
        sublabel={ocupacaoSubtitle}
        icon={Activity}
        accent="violet"
        progress={kpis.ocupacaoOTB}
      />
      <KpiCard
        label="ADR OTB"
        value={formatCurrency(kpis.adrOTB)}
        sublabel="Preço médio por noite"
        icon={TrendingUp}
        accent="amber"
      />
      <KpiCard
        label="Ticket Médio"
        value={formatCurrency(kpis.ticketMedioOTB)}
        sublabel={`${kpis.totalReservasOTB} reservas`}
        icon={Hash}
        accent="slate"
      />
      <KpiCard
        label="Noites Vendidas"
        value={String(kpis.noitesVendidasOTB)}
        sublabel={`${kpis.noitesDisponiveis} ainda disponíveis`}
        icon={Bed}
        accent="blue"
      />
      <KpiCard
        label="Antecedência Média"
        value={`${kpis.antecedenciaMedia.toFixed(0)} dias`}
        sublabel="Lead time das reservas"
        icon={Calendar}
        accent="green"
      />
      <KpiCard
        label="Reservas Confirmadas"
        value={String(kpis.totalReservasOTB)}
        sublabel="Total em OTB"
        icon={Users}
        accent="violet"
      />
    </div>
  )
}
