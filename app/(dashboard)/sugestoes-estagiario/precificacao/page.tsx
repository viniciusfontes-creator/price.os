"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  Check,
  X,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Loader2,
  LayoutGrid,
  Table as TableIcon,
  TrendingUp,
  TrendingDown,
  Tags,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { canApprove } from "@/lib/metas-ajustes/rbac"
import {
  DraggableCard,
  DroppableColumn,
  KanbanDnDProvider,
} from "@/components/sugestoes-estagiario/kanban-dnd"
import { UnitDetailTabs } from "@/components/sugestoes-estagiario/unit-detail-tabs"
import type {
  PricingAjusteProposto,
  PricingStatus,
  PricingConfianca,
  PricingSaude,
} from "@/lib/pricing-ajustes/types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const STATUS_LABEL: Record<PricingStatus, string> = {
  pendente: "Pendente",
  aprovado: "Aprovada",
  rejeitado: "Rejeitada",
  aplicado: "Aplicada",
  falhou: "Falhou",
}

const STATUS_DOT: Record<PricingStatus, string> = {
  pendente: "bg-amber-500",
  aprovado: "bg-blue-500",
  rejeitado: "bg-zinc-400",
  aplicado: "bg-emerald-500",
  falhou: "bg-rose-500",
}

const SAUDE_LABEL: Record<PricingSaude, string> = {
  barato: "Barato",
  barato_recuperavel: "Barato (recuperável)",
  caro: "Caro",
  caro_validado: "Caro (validado)",
  ok: "OK",
  sem_dados: "Sem dados",
}

const KANBAN_COLUMNS: PricingStatus[] = ["pendente", "aprovado", "aplicado", "rejeitado"]

// ============================================================================
// HELPERS
// ============================================================================
function fmtBRL(v: number | null | undefined) {
  if (v === null || v === undefined) return "—"
  const n = Number(v)
  if (!Number.isFinite(n)) return "—"
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  })
}

function StatusBadge({ status }: { status: PricingStatus }) {
  const variants: Record<PricingStatus, string> = {
    pendente: "bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200",
    aprovado: "bg-blue-100 text-blue-900 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-200",
    rejeitado: "bg-zinc-200 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200",
    aplicado:
      "bg-emerald-100 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-200",
    falhou: "bg-rose-100 text-rose-900 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-200",
  }
  return <Badge variant="secondary" className={variants[status]}>{STATUS_LABEL[status]}</Badge>
}

function ConfBadge({ c }: { c: PricingConfianca | null }) {
  if (!c) return null
  const colors: Record<PricingConfianca, string> = {
    alta: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200",
    media: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200",
    baixa: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-950 dark:text-rose-200",
  }
  return <span className={`text-xs px-2 py-0.5 rounded border ${colors[c]}`}>{c}</span>
}

function SaudeBadge({ s }: { s: PricingSaude | null }) {
  if (!s) return null
  const colors: Record<PricingSaude, string> = {
    barato: "bg-orange-100 text-orange-900 border-orange-200",
    barato_recuperavel: "bg-amber-100 text-amber-900 border-amber-200",
    caro: "bg-rose-100 text-rose-900 border-rose-200",
    caro_validado: "bg-purple-100 text-purple-900 border-purple-200",
    ok: "bg-zinc-100 text-zinc-700 border-zinc-200",
    sem_dados: "bg-zinc-100 text-zinc-500 border-zinc-200",
  }
  return <span className={`text-[10px] px-2 py-0.5 rounded border ${colors[s]}`}>{SAUDE_LABEL[s]}</span>
}

function DeltaBadge({ delta }: { delta: number }) {
  const isUp = delta > 0
  const color = isUp ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
  const Icon = isUp ? ArrowUp : ArrowDown
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(delta).toFixed(1)}%
    </span>
  )
}

// ============================================================================
// JUSTIFICATIVA RENDERER (mesmo padrão da página de metas)
// ============================================================================
type JustBlock =
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "paragraph"; text: string }
  | { type: "alert"; text: string }

function parseJustificativa(texto: string): JustBlock[] {
  const blocks: JustBlock[] = []
  let listAcc: string[] | null = null
  function flushList() {
    if (listAcc && listAcc.length > 0) blocks.push({ type: "list", items: listAcc })
    listAcc = null
  }
  for (const raw of texto.split("\n")) {
    const linha = raw.trimEnd()
    if (linha.startsWith("## ")) {
      flushList()
      blocks.push({ type: "heading", text: linha.slice(3) })
    } else if (linha.startsWith("• ")) {
      if (!listAcc) listAcc = []
      listAcc.push(linha.slice(2))
    } else if (linha.startsWith("⚠️")) {
      flushList()
      blocks.push({ type: "alert", text: linha })
    } else if (linha.trim()) {
      flushList()
      blocks.push({ type: "paragraph", text: linha })
    } else {
      flushList()
    }
  }
  flushList()
  return blocks
}

function JustificativaRender({ texto }: { texto: string }) {
  const blocks = useMemo(() => parseJustificativa(texto), [texto])
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((b, i) => {
        if (b.type === "heading") {
          return (
            <div
              key={i}
              className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {b.text}
            </div>
          )
        }
        if (b.type === "list") {
          return (
            <ul key={i} className="space-y-1.5">
              {b.items.map((item, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-muted-foreground select-none mt-0.5">•</span>
                  <span className="flex-1">{item}</span>
                </li>
              ))}
            </ul>
          )
        }
        if (b.type === "alert") {
          return (
            <div
              key={i}
              className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-900 px-3 py-2 text-amber-900 dark:text-amber-200 text-sm"
            >
              {b.text}
            </div>
          )
        }
        return <p key={i}>{b.text}</p>
      })}
    </div>
  )
}

// ============================================================================
// KPI CARDS
// ============================================================================
function KpiCards({ propostas }: { propostas: PricingAjusteProposto[] }) {
  const kpis = useMemo(() => {
    const pendentes = propostas.filter((p) => p.status === "pendente")
    const aplicadas = propostas.filter((p) => p.status === "aplicado")
    const aprovadas = propostas.filter((p) => p.status === "aprovado")
    const altas = pendentes.filter((p) => p.confianca === "alta")
    const baratosCount = pendentes.filter((p) => String(p.saude).startsWith("barato")).length
    const carosCount = pendentes.filter((p) => String(p.saude).startsWith("caro")).length

    const deltaMedio =
      pendentes.length > 0
        ? pendentes.reduce((s, p) => s + Number(p.delta_pct), 0) / pendentes.length
        : 0

    return {
      pendentesCount: pendentes.length,
      baratosCount,
      carosCount,
      aprovadasCount: aprovadas.length + aplicadas.length,
      altaConfiancaCount: altas.length,
      deltaMedio,
    }
  }, [propostas])

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Tags className="h-3.5 w-3.5" />
            Pendentes
          </div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{kpis.pendentesCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {kpis.baratosCount} baratos · {kpis.carosCount} caros
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {kpis.deltaMedio >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            Δ médio (pendentes)
          </div>
          <div
            className={`text-2xl font-semibold mt-1 tabular-nums ${
              kpis.deltaMedio >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
            }`}
          >
            {kpis.deltaMedio >= 0 ? "+" : ""}
            {kpis.deltaMedio.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">vs baserate atual</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Confiança alta
          </div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{kpis.altaConfiancaCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">prontas para revisão rápida</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Decididas
          </div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{kpis.aprovadasCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">aprovadas + aplicadas</div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// CHARTS
// ============================================================================
function DistribuicaoPorPraca({ propostas }: { propostas: PricingAjusteProposto[] }) {
  const data = useMemo(() => {
    const pend = propostas.filter((p) => p.status === "pendente")
    const map = new Map<string, { praca: string; up: number; down: number }>()
    for (const p of pend) {
      const key = p.praca ?? "—"
      const cur = map.get(key) ?? { praca: key, up: 0, down: 0 }
      if (Number(p.delta_pct) > 0) cur.up += 1
      else cur.down += 1
      map.set(key, cur)
    }
    return Array.from(map.values())
      .sort((a, b) => b.up + b.down - (a.up + a.down))
      .slice(0, 6)
  }, [propostas])

  if (data.length === 0) return <EmptyChart message="Sem propostas pendentes" />

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="praca"
          width={100}
          tick={{ fontSize: 11 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <RechartsTooltip
          cursor={{ fill: "rgba(127,127,127,0.08)" }}
          contentStyle={{
            background: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value, name) => {
            const label = name === "up" ? "↑ subir" : "↓ baixar"
            return [String(value), label]
          }}
        />
        <Bar dataKey="up" stackId="s" fill="#10b981" radius={[0, 0, 0, 0]} />
        <Bar dataKey="down" stackId="s" fill="#f43f5e" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function DistribuicaoPorPeriodo({ propostas }: { propostas: PricingAjusteProposto[] }) {
  const data = useMemo(() => {
    const pend = propostas.filter((p) => p.status === "pendente")
    const map = new Map<string, number>()
    for (const p of pend) {
      const key = p.periodo_nome
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([periodo, count]) => ({ periodo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [propostas])

  if (data.length === 0) return <EmptyChart message="Sem propostas pendentes" />

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 4 }}>
        <XAxis dataKey="periodo" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
        <RechartsTooltip
          cursor={{ fill: "rgba(127,127,127,0.08)" }}
          contentStyle={{
            background: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill="#3b82f6" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

// ============================================================================
// KANBAN
// ============================================================================
function KanbanCard({
  p,
  selected,
  onClick,
  onSelectChange,
  selectable,
  draggable,
}: {
  p: PricingAjusteProposto
  selected: boolean
  onClick: () => void
  onSelectChange: (checked: boolean) => void
  selectable: boolean
  draggable: boolean
}) {
  const delta = Number(p.delta_pct)
  return (
    <DraggableCard id={p.id} disabled={!draggable}>
    <div
      onClick={onClick}
      className="group rounded-lg border bg-card p-3 hover:border-primary hover:shadow-sm transition space-y-2"
    >
      <div className="flex items-start gap-2">
        {selectable && (
          <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
            <Checkbox
              checked={selected}
              onCheckedChange={(v) => onSelectChange(Boolean(v))}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-tight line-clamp-2">
            {p.nomepropriedade ?? p.idpropriedade}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {p.praca ?? "—"} · {p.periodo_nome}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs">
          <span className="text-muted-foreground line-through">{fmtBRL(p.baserate_atual)}</span>{" "}
          <span className="font-semibold">{fmtBRL(p.baserate_sugerido)}</span>
        </div>
        <DeltaBadge delta={delta} />
      </div>

      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 flex-wrap">
          <SaudeBadge s={p.saude} />
          <ConfBadge c={p.confianca} />
        </div>
        {p.fora_do_peer && (
          <span className="text-[10px] text-amber-700 font-mono" title="Mais de 20% fora da mediana do peer">
            ⚠ peer
          </span>
        )}
      </div>
    </div>
    </DraggableCard>
  )
}

function KanbanColumn({
  status,
  propostas,
  selected,
  onCardClick,
  onSelectChange,
  selectable,
  dndEnabled,
}: {
  status: PricingStatus
  propostas: PricingAjusteProposto[]
  selected: Set<number>
  onCardClick: (id: number) => void
  onSelectChange: (id: number, checked: boolean) => void
  selectable: boolean
  dndEnabled: boolean
}) {
  const canAcceptDrop = dndEnabled && (status === "aprovado" || status === "rejeitado")
  return (
    <DroppableColumn id={status} disabled={!canAcceptDrop}>
    <div className="flex flex-col rounded-lg border bg-muted/30 min-h-[400px]">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-background rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
          <span className="text-sm font-semibold">{STATUS_LABEL[status]}</span>
        </div>
        <Badge variant="outline" className="tabular-nums">
          {propostas.length}
        </Badge>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[70vh]">
        {propostas.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-8">vazia</div>
        ) : (
          propostas.map((p) => (
            <KanbanCard
              key={p.id}
              p={p}
              selected={selected.has(p.id)}
              onClick={() => onCardClick(p.id)}
              onSelectChange={(c) => onSelectChange(p.id, c)}
              selectable={selectable && status === "pendente"}
              draggable={dndEnabled && status === "pendente"}
            />
          ))
        )}
      </div>
    </div>
    </DroppableColumn>
  )
}

// ============================================================================
// TABLE
// ============================================================================
function PropostaTable({
  propostas,
  selected,
  onCardClick,
  onSelectChange,
  onSelectAll,
  selectable,
  showSelection,
}: {
  propostas: PricingAjusteProposto[]
  selected: Set<number>
  onCardClick: (id: number) => void
  onSelectChange: (id: number, checked: boolean) => void
  onSelectAll: () => void
  selectable: boolean
  showSelection: boolean
}) {
  const allPendentes = propostas.filter((p) => p.status === "pendente")
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {showSelection && (
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    selected.size > 0 &&
                    selected.size === allPendentes.length &&
                    allPendentes.length > 0
                  }
                  onCheckedChange={onSelectAll}
                />
              </TableHead>
            )}
            <TableHead>Unidade</TableHead>
            <TableHead>Praça</TableHead>
            <TableHead>Período</TableHead>
            <TableHead className="text-right">Atual</TableHead>
            <TableHead className="text-right">Sugerido</TableHead>
            <TableHead className="text-right">Δ</TableHead>
            <TableHead>Saúde</TableHead>
            <TableHead>Conf.</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {propostas.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={showSelection ? 10 : 9}
                className="text-center py-8 text-muted-foreground"
              >
                Nenhuma proposta encontrada
              </TableCell>
            </TableRow>
          ) : (
            propostas.map((p) => (
              <TableRow
                key={p.id}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => onCardClick(p.id)}
              >
                {showSelection && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={(c) => onSelectChange(p.id, Boolean(c))}
                      disabled={p.status !== "pendente" || !selectable}
                    />
                  </TableCell>
                )}
                <TableCell className="font-medium max-w-xs">
                  <div className="line-clamp-1">{p.nomepropriedade ?? p.idpropriedade}</div>
                </TableCell>
                <TableCell>{p.praca ?? "—"}</TableCell>
                <TableCell className="tabular-nums">{p.periodo_nome}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtBRL(p.baserate_atual)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {fmtBRL(p.baserate_sugerido)}
                </TableCell>
                <TableCell className="text-right">
                  <DeltaBadge delta={Number(p.delta_pct)} />
                </TableCell>
                <TableCell>
                  <SaudeBadge s={p.saude} />
                </TableCell>
                <TableCell>
                  <ConfBadge c={p.confianca} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={p.status} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

// ============================================================================
// MAIN
// ============================================================================
export default function PrecificacaoPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const userIsApprover = canApprove(session?.user?.email)

  const [viewMode, setViewMode] = useState<"kanban" | "tabela">("kanban")
  const [pracaFilter, setPracaFilter] = useState<string>("")
  const [periodoFilter, setPeriodoFilter] = useState<string>("")
  const [tipoPeriodoFilter, setTipoPeriodoFilter] = useState<string>("")
  const [confFilter, setConfFilter] = useState<string>("")
  const [saudeFilter, setSaudeFilter] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("pendente")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [drawerId, setDrawerId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [comentario, setComentario] = useState("")
  const [valorEditado, setValorEditado] = useState<string>("")

  const { data, error, isLoading, mutate } = useSWR<{ data: PricingAjusteProposto[] }>(
    `/api/pricing/ajustes?status=todos&limit=1000`,
    fetcher,
  )

  const todasPropostas = data?.data ?? []

  const propostasFiltradas = useMemo(() => {
    return todasPropostas.filter((p) => {
      if (pracaFilter && p.praca !== pracaFilter) return false
      if (periodoFilter && p.periodo_nome !== periodoFilter) return false
      if (tipoPeriodoFilter && p.periodo_tipo !== tipoPeriodoFilter) return false
      if (confFilter && p.confianca !== confFilter) return false
      if (saudeFilter && p.saude !== saudeFilter) return false
      return true
    })
  }, [todasPropostas, pracaFilter, periodoFilter, tipoPeriodoFilter, confFilter, saudeFilter])

  const pracasDisponiveis = useMemo(
    () =>
      Array.from(new Set(todasPropostas.map((p) => p.praca).filter(Boolean))).sort() as string[],
    [todasPropostas],
  )

  // Períodos ordenados cronologicamente (pelo start_date), filtrados pelo tipo (se aplicável).
  const periodosDisponiveis = useMemo(() => {
    const map = new Map<string, { nome: string; start: string; tipo: string }>()
    for (const p of todasPropostas) {
      if (!p.periodo_nome) continue
      if (tipoPeriodoFilter && p.periodo_tipo !== tipoPeriodoFilter) continue
      const cur = map.get(p.periodo_nome)
      if (!cur || (p.periodo_inicio && p.periodo_inicio < cur.start)) {
        map.set(p.periodo_nome, {
          nome: p.periodo_nome,
          start: p.periodo_inicio ?? "9999-12-31",
          tipo: p.periodo_tipo,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.start.localeCompare(b.start))
  }, [todasPropostas, tipoPeriodoFilter])

  const propostasPorStatus = useMemo(() => {
    const map: Record<PricingStatus, PricingAjusteProposto[]> = {
      pendente: [],
      aprovado: [],
      rejeitado: [],
      aplicado: [],
      falhou: [],
    }
    for (const p of propostasFiltradas) map[p.status].push(p)
    return map
  }, [propostasFiltradas])

  const propostasTabela = useMemo(() => {
    if (statusFilter === "todos") return propostasFiltradas
    return propostasFiltradas.filter((p) => p.status === statusFilter)
  }, [propostasFiltradas, statusFilter])

  const dropOpen = drawerId !== null ? todasPropostas.find((p) => p.id === drawerId) : null

  function toggleSelect(id: number, checked: boolean) {
    setSelected((s) => {
      const next = new Set(s)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleSelectAll() {
    const pendentes = propostasTabela.filter((p) => p.status === "pendente")
    if (selected.size === pendentes.length && pendentes.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pendentes.map((p) => p.id)))
    }
  }

  async function handleDecide(
    id: number,
    acao: "aprovar" | "rejeitar",
    coment?: string | null,
    valor?: number | null,
  ) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/pricing/ajustes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao,
          comentario: coment ?? null,
          valor_editado: valor ?? null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro")
      toast({
        title: acao === "aprovar" ? "Proposta aprovada" : "Proposta rejeitada",
        description: `#${id} • ${STATUS_LABEL[json.data.status as PricingStatus]}`,
      })
      setDrawerId(null)
      setComentario("")
      setValorEditado("")
      mutate()
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Falha desconhecida",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleBulk(acao: "aprovar" | "rejeitar") {
    if (selected.size === 0) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/pricing/ajustes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), acao }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro")
      toast({
        title: `${json.processed} propostas ${acao === "aprovar" ? "aprovadas" : "rejeitadas"}`,
        description: json.skipped > 0 ? `${json.skipped} ignoradas (já decididas)` : undefined,
      })
      setSelected(new Set())
      mutate()
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Falha desconhecida",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const showBulk = userIsApprover && selected.size > 0

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Ajustes de Precificação</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Propostas quinzenais de ajuste de baserate por período (mês/evento), geradas automaticamente.
            {!userIsApprover && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" /> Modo somente leitura
              </span>
            )}
          </p>
        </div>
      </div>

      <KpiCards propostas={propostasFiltradas} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-1">Pendentes por praça</div>
            <div className="text-xs text-muted-foreground mb-2">
              Top 6, divididas por direção do ajuste
            </div>
            <DistribuicaoPorPraca propostas={propostasFiltradas} />
            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-emerald-500" /> subir
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-rose-500" /> baixar
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-1">Pendentes por período</div>
            <div className="text-xs text-muted-foreground mb-2">
              Top 8 períodos com mais propostas
            </div>
            <DistribuicaoPorPeriodo propostas={propostasFiltradas} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Visão</Label>
              <div className="flex rounded-md border p-0.5">
                <Button
                  size="sm"
                  variant={viewMode === "kanban" ? "default" : "ghost"}
                  onClick={() => setViewMode("kanban")}
                  className="h-7 px-2"
                >
                  <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Kanban
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "tabela" ? "default" : "ghost"}
                  onClick={() => setViewMode("tabela")}
                  className="h-7 px-2"
                >
                  <TableIcon className="h-3.5 w-3.5 mr-1" /> Tabela
                </Button>
              </div>
            </div>

            {viewMode === "tabela" && (
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                    <SelectItem value="aprovado">Aprovadas</SelectItem>
                    <SelectItem value="aplicado">Aplicadas</SelectItem>
                    <SelectItem value="rejeitado">Rejeitadas</SelectItem>
                    <SelectItem value="falhou">Falharam</SelectItem>
                    <SelectItem value="todos">Todas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Praça</Label>
              <Select
                value={pracaFilter || "all"}
                onValueChange={(v) => setPracaFilter(v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-44 h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {pracasDisponiveis.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tipo de período</Label>
              <Select
                value={tipoPeriodoFilter || "all"}
                onValueChange={(v) => setTipoPeriodoFilter(v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="month">Mensal</SelectItem>
                  <SelectItem value="event">Evento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Período</Label>
              <Select
                value={periodoFilter || "all"}
                onValueChange={(v) => setPeriodoFilter(v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-44 h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="all">Todos</SelectItem>
                  {periodosDisponiveis.map((p) => (
                    <SelectItem key={p.nome} value={p.nome}>
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            p.tipo === "event" ? "bg-violet-500" : "bg-sky-500"
                          }`}
                        />
                        {p.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Saúde</Label>
              <Select
                value={saudeFilter || "all"}
                onValueChange={(v) => setSaudeFilter(v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-44 h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="barato">Barato</SelectItem>
                  <SelectItem value="barato_recuperavel">Barato (recuperável)</SelectItem>
                  <SelectItem value="caro">Caro</SelectItem>
                  <SelectItem value="caro_validado">Caro (validado)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Confiança</Label>
              <Select
                value={confFilter || "all"}
                onValueChange={(v) => setConfFilter(v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {showBulk && (
                <>
                  <span className="text-sm text-muted-foreground">{selected.size} selecionadas</span>
                  <Button size="sm" onClick={() => handleBulk("aprovar")} disabled={submitting}>
                    <Check className="h-4 w-4 mr-1" /> Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulk("rejeitar")}
                    disabled={submitting}
                  >
                    <X className="h-4 w-4 mr-1" /> Rejeitar
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
        </div>
      )}
      {error && <div className="text-center py-8 text-red-600">Erro ao carregar propostas</div>}

      {!isLoading && !error && (
        <>
          {viewMode === "kanban" ? (
            <KanbanDnDProvider
              onDrop={(cardId, columnId) => {
                if (!userIsApprover) return
                const id = Number(cardId)
                const proposta = todasPropostas.find((p) => p.id === id)
                if (!proposta || proposta.status !== "pendente") return
                if (columnId === "aprovado") handleDecide(id, "aprovar")
                else if (columnId === "rejeitado") handleDecide(id, "rejeitar")
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {KANBAN_COLUMNS.map((status) => (
                  <KanbanColumn
                    key={status}
                    status={status}
                    propostas={propostasPorStatus[status]}
                    selected={selected}
                    onCardClick={setDrawerId}
                    onSelectChange={toggleSelect}
                    selectable={userIsApprover}
                    dndEnabled={userIsApprover}
                  />
                ))}
              </div>
            </KanbanDnDProvider>
          ) : (
            <PropostaTable
              propostas={propostasTabela}
              selected={selected}
              onCardClick={setDrawerId}
              onSelectChange={toggleSelect}
              onSelectAll={toggleSelectAll}
              selectable={userIsApprover}
              showSelection={userIsApprover && statusFilter === "pendente"}
            />
          )}
        </>
      )}

      <Sheet open={drawerId !== null} onOpenChange={(o) => !o && setDrawerId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
          {dropOpen && (
            <div className="flex flex-col h-full">
              <SheetHeader className="px-6 pt-6 pb-4 border-b">
                <SheetTitle className="text-base leading-tight pr-6">
                  {dropOpen.nomepropriedade ?? dropOpen.idpropriedade}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {dropOpen.praca ?? "—"} · {dropOpen.grupo_nome ?? "—"} · {dropOpen.periodo_nome}
                  {dropOpen.periodo_inicio && dropOpen.periodo_fim && (
                    <span className="ml-1">
                      ({format(new Date(dropOpen.periodo_inicio), "dd/MM", { locale: ptBR })}–
                      {format(new Date(dropOpen.periodo_fim), "dd/MM", { locale: ptBR })})
                    </span>
                  )}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Baserate atual</div>
                    <div className="text-lg font-semibold tabular-nums mt-0.5">
                      {fmtBRL(dropOpen.baserate_atual)}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Baserate sugerido</div>
                    <div className="text-lg font-semibold tabular-nums mt-0.5">
                      {fmtBRL(dropOpen.baserate_sugerido)}
                    </div>
                    <div className="mt-0.5">
                      <DeltaBadge delta={Number(dropOpen.delta_pct)} />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Sinais</div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <span
                        className="text-muted-foreground"
                        title="meta_mensal × share_pct/100 ÷ expected_nights — mesma fórmula da página /propriedades/pricing."
                      >
                        Preço ótimo (meta × sazonalidade)
                      </span>
                      <span className="tabular-nums">{fmtBRL(dropOpen.optimal_price)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span
                        className="text-muted-foreground"
                        title="Mediana de preço médio noite (12m) das unidades do mesmo grupo com ±1 hóspede."
                      >
                        Peer group {dropOpen.peer_count ? `(n=${dropOpen.peer_count})` : ""}
                      </span>
                      <span className="tabular-nums">{fmtBRL(dropOpen.peer_median_price)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span
                        className="text-muted-foreground"
                        title="Diária média ponderada (SUM pricePerNight × nightCount / SUM nightCount) na mesma janela do ano anterior."
                      >
                        Histórico ano passado{" "}
                        {dropOpen.reservas_anterior ? `(n=${dropOpen.reservas_anterior})` : ""}
                      </span>
                      <span className="tabular-nums">{fmtBRL(dropOpen.diaria_anterior)}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <SaudeBadge s={dropOpen.saude} />
                    {dropOpen.confianca && <ConfBadge c={dropOpen.confianca} />}
                    {dropOpen.fora_do_peer && (
                      <span className="px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                        ⚠ fora do peer
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Justificativa</div>
                  <div className="bg-muted/40 rounded-lg p-4">
                    {dropOpen.justificativa ? (
                      <JustificativaRender texto={dropOpen.justificativa} />
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Análise contextual</div>
                  <UnitDetailTabs
                    idpropriedade={dropOpen.idpropriedade}
                    unitName={dropOpen.nomepropriedade ?? dropOpen.idpropriedade}
                    periodoInicio={dropOpen.periodo_inicio}
                    periodoFim={dropOpen.periodo_fim}
                    baserateAtual={dropOpen.baserate_atual}
                  />
                </div>

                <div className="text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={dropOpen.status} />
                  </div>
                  <div className="mt-2">
                    Criada em{" "}
                    {format(new Date(dropOpen.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    {dropOpen.aprovado_por && (
                      <>
                        {" "}• Decidida por {dropOpen.aprovado_por}
                        {dropOpen.aprovado_em &&
                          ` em ${format(new Date(dropOpen.aprovado_em), "dd/MM/yyyy HH:mm", {
                            locale: ptBR,
                          })}`}
                      </>
                    )}
                  </div>
                </div>

                {dropOpen.comentario_revisor && (
                  <div>
                    <div className="text-sm font-medium mb-1">Comentário do revisor</div>
                    <div className="text-sm bg-muted/40 rounded-lg p-3">
                      {dropOpen.comentario_revisor}
                    </div>
                  </div>
                )}

                {dropOpen.apply_error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-900 p-3 text-sm text-red-900 dark:text-red-200">
                    <div className="font-medium">Erro ao aplicar</div>
                    {dropOpen.apply_error}
                  </div>
                )}

                {userIsApprover && dropOpen.status === "pendente" && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="space-y-1.5">
                      <Label htmlFor="valor-editado">Valor a aplicar (opcional)</Label>
                      <Input
                        id="valor-editado"
                        type="number"
                        step="0.01"
                        placeholder={String(dropOpen.baserate_sugerido)}
                        value={valorEditado}
                        onChange={(e) => setValorEditado(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Deixe vazio para usar o valor sugerido ({fmtBRL(dropOpen.baserate_sugerido)}).
                        ⚠ A aplicação atual apenas marca como aprovado — você precisa atualizar o
                        baserate manualmente no Stays.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="coment">Comentário</Label>
                      <Textarea
                        id="coment"
                        placeholder="Opcional"
                        value={comentario}
                        onChange={(e) => setComentario(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {userIsApprover && dropOpen.status === "pendente" && (
                <SheetFooter className="border-t px-6 py-4 flex-row gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleDecide(dropOpen.id, "rejeitar", comentario || null)}
                    disabled={submitting}
                  >
                    <X className="h-4 w-4 mr-1" /> Rejeitar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() =>
                      handleDecide(
                        dropOpen.id,
                        "aprovar",
                        comentario || null,
                        valorEditado ? Number(valorEditado) : null,
                      )
                    }
                    disabled={submitting}
                  >
                    <Check className="h-4 w-4 mr-1" /> Aprovar
                  </Button>
                </SheetFooter>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
