"use client"

import { useEffect, useMemo, useState } from "react"
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
  Target,
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
import { TableSkeleton } from "@/components/page-skeleton"
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
import type {
  MetaAjusteProposto,
  StatusProposta,
  Confianca,
} from "@/lib/metas-ajustes/types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const STATUS_LABEL: Record<StatusProposta, string> = {
  pendente: "Pendente",
  aprovado: "Aprovada",
  rejeitado: "Rejeitada",
  aplicado: "Aplicada",
  falhou: "Falhou",
}

const STATUS_DOT: Record<StatusProposta, string> = {
  pendente: "bg-amber-500",
  aprovado: "bg-blue-500",
  rejeitado: "bg-zinc-400",
  aplicado: "bg-emerald-500",
  falhou: "bg-rose-500",
}

const KANBAN_COLUMNS: StatusProposta[] = ["pendente", "aprovado", "aplicado", "rejeitado"]

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

function fmtBRLCompact(v: number) {
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`
  return `R$ ${Math.round(v)}`
}

function fmtPct(v: number | null | undefined, digits = 0) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  return `${(Number(v) * 100).toFixed(digits)}%`
}

// ============================================================================
// LIVE DATA (BQ refresh) — atualiza diariamente OTB / meta móvel / ocupação
// ============================================================================
interface LiveEntry {
  idpropriedade: string
  mes_ano: string
  otb_atual: number | null
  meta_movel_atual: number | null
  receita_ano_passado: number | null
  receita_ano_atual: number | null
  ocupacao_ano_passado: number | null
  ocupacao_ano_atual: number | null
  diaria_atual: number | null
  atualizado_em: string
}

function liveKey(idprop: string, mesAno: string) {
  return `${idprop}__${mesAno}`
}

function StatusBadge({ status }: { status: StatusProposta }) {
  const variants: Record<StatusProposta, string> = {
    pendente: "bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200",
    aprovado: "bg-blue-100 text-blue-900 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-200",
    rejeitado: "bg-zinc-200 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200",
    aplicado: "bg-emerald-100 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-200",
    falhou: "bg-rose-100 text-rose-900 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-200",
  }
  return <Badge variant="secondary" className={variants[status]}>{STATUS_LABEL[status]}</Badge>
}

function ConfBadge({ c }: { c: Confianca | null }) {
  if (!c) return null
  const colors: Record<Confianca, string> = {
    alta: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200",
    media: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200",
    baixa: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-950 dark:text-rose-200",
  }
  return <span className={`text-xs px-2 py-0.5 rounded border ${colors[c]}`}>{c}</span>
}

type JustBlock =
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "paragraph"; text: string }
  | { type: "alert"; text: string }

function parseJustificativa(texto: string): JustBlock[] {
  const blocks: JustBlock[] = []
  let listAcc: string[] | null = null

  function flushList() {
    if (listAcc && listAcc.length > 0) {
      blocks.push({ type: "list", items: listAcc })
    }
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
// KPI CARDS
// ============================================================================
function KpiCards({ propostas }: { propostas: MetaAjusteProposto[] }) {
  const kpis = useMemo(() => {
    const pendentes = propostas.filter((p) => p.status === "pendente")
    const aplicadas = propostas.filter((p) => p.status === "aplicado")
    const aprovadas = propostas.filter((p) => p.status === "aprovado")
    const altas = pendentes.filter((p) => p.confianca === "alta")

    const ajustePendente = pendentes.reduce(
      (sum, p) => sum + (Number(p.meta_sugerida) - Number(p.meta_atual)),
      0,
    )
    const deltaMedio =
      pendentes.length > 0
        ? pendentes.reduce((s, p) => s + Number(p.delta_pct), 0) / pendentes.length
        : 0

    return {
      pendentesCount: pendentes.length,
      ajustePendente,
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
            <Target className="h-3.5 w-3.5" />
            Pendentes
          </div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{kpis.pendentesCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            ajuste líquido {fmtBRLCompact(kpis.ajustePendente)}
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
          <div className="text-xs text-muted-foreground mt-0.5">
            sobre meta atual
          </div>
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
function DistribuicaoPorPraca({ propostas }: { propostas: MetaAjusteProposto[] }) {
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

  if (data.length === 0) {
    return <EmptyChart message="Sem propostas pendentes" />
  }

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

function DistribuicaoPorMes({ propostas }: { propostas: MetaAjusteProposto[] }) {
  const data = useMemo(() => {
    const pend = propostas.filter((p) => p.status === "pendente")
    const map = new Map<string, number>()
    for (const p of pend) {
      map.set(p.mes_ano, (map.get(p.mes_ano) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .sort((a, b) => {
        const [ma, ya] = a[0].split("/").map(Number)
        const [mb, yb] = b[0].split("/").map(Number)
        return ya === yb ? ma - mb : ya - yb
      })
      .map(([mes, count]) => ({ mes, count }))
  }, [propostas])

  if (data.length === 0) {
    return <EmptyChart message="Sem propostas pendentes" />
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 4 }}>
        <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
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
  processing,
  live,
}: {
  p: MetaAjusteProposto
  selected: boolean
  onClick: () => void
  onSelectChange: (checked: boolean) => void
  selectable: boolean
  draggable: boolean
  processing: boolean
  live?: LiveEntry | null
}) {
  const delta = Number(p.delta_pct)
  const diaria = Number(live?.diaria_atual ?? p.diaria_unidade_12m) || 0
  const noitesNecessarias =
    diaria > 0 ? Math.ceil(Number(p.meta_sugerida) / diaria) : null
  return (
    <DraggableCard id={p.id} disabled={!draggable || processing}>
    <div
      onClick={processing ? undefined : onClick}
      aria-busy={processing}
      className={`group relative rounded-lg border bg-card p-3 hover:border-primary hover:shadow-sm transition space-y-2 ${
        processing ? "opacity-60 pointer-events-none" : ""
      }`}
    >
      {processing && (
        <div className="absolute top-2 right-2 z-10">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        </div>
      )}
      <div className="flex items-start gap-2">
        {selectable && (
          <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
            <Checkbox
              checked={selected}
              onCheckedChange={(v) => onSelectChange(Boolean(v))}
              disabled={processing}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-tight line-clamp-2">
            {p.nomepropriedade ?? p.idpropriedade}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {p.praca ?? "—"} • {p.mes_ano}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs">
          <span className="text-muted-foreground line-through">{fmtBRL(p.meta_atual)}</span>{" "}
          <span className="font-semibold">{fmtBRL(p.meta_sugerida)}</span>
        </div>
        <DeltaBadge delta={delta} />
      </div>

      <div className="grid grid-cols-3 gap-1.5 border-t pt-1.5 text-[10px]">
        <div
          className="min-w-0"
          title="Ocupação no mesmo mês: ano passado → ano atual (até hoje). Fonte: stage.ocupacaoDisponibilidade."
        >
          <div className="text-muted-foreground truncate">Ocupação Y/Y</div>
          <div className="tabular-nums font-medium truncate">
            {live
              ? `${fmtPct(live.ocupacao_ano_passado)} → ${fmtPct(live.ocupacao_ano_atual)}`
              : "…"}
          </div>
        </div>
        <div
          className="min-w-0"
          title="Receita realizada no mesmo mês: ano passado → ano atual. Fonte: warehouse.reservas_all (checkout)."
        >
          <div className="text-muted-foreground truncate">Receita Y/Y</div>
          <div className="tabular-nums font-medium truncate">
            {live
              ? `${fmtBRLCompact(Number(live.receita_ano_passado) || 0)} → ${fmtBRLCompact(
                  Number(live.receita_ano_atual) || 0,
                )}`
              : "…"}
          </div>
        </div>
        <div
          className="min-w-0"
          title="Noites necessárias = meta sugerida ÷ tarifário atual (diária média)"
        >
          <div className="text-muted-foreground truncate">Noites nec.</div>
          <div className="tabular-nums font-medium truncate">
            {noitesNecessarias != null ? `${noitesNecessarias} noites` : "—"}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <ConfBadge c={p.confianca} />
        {p.cenario && (
          <span className="text-[10px] text-muted-foreground font-mono">{p.cenario}</span>
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
  processingIds,
  onCardClick,
  onSelectChange,
  selectable,
  dndEnabled,
  liveByKey,
}: {
  status: StatusProposta
  propostas: MetaAjusteProposto[]
  selected: Set<number>
  processingIds: Set<number>
  onCardClick: (id: number) => void
  onSelectChange: (id: number, checked: boolean) => void
  selectable: boolean
  dndEnabled: boolean
  liveByKey: Map<string, LiveEntry>
}) {
  // Só permite drop em aprovado/rejeitado (vindo de pendente).
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
              processing={processingIds.has(p.id)}
              live={liveByKey.get(liveKey(p.idpropriedade, p.mes_ano)) ?? null}
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
  propostas: MetaAjusteProposto[]
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
                  checked={selected.size > 0 && selected.size === allPendentes.length && allPendentes.length > 0}
                  onCheckedChange={onSelectAll}
                />
              </TableHead>
            )}
            <TableHead>Unidade</TableHead>
            <TableHead>Praça</TableHead>
            <TableHead>Mês</TableHead>
            <TableHead className="text-right">Atual</TableHead>
            <TableHead className="text-right">Sugerida</TableHead>
            <TableHead className="text-right">Δ</TableHead>
            <TableHead>Conf.</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {propostas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showSelection ? 9 : 8} className="text-center py-8 text-muted-foreground">
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
                <TableCell className="tabular-nums">{p.mes_ano}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtBRL(p.meta_atual)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {fmtBRL(p.meta_sugerida)}
                </TableCell>
                <TableCell className="text-right">
                  <DeltaBadge delta={Number(p.delta_pct)} />
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
export default function MetasAjustesPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const userIsApprover = canApprove(session?.user?.email)

  const [viewMode, setViewMode] = useState<"kanban" | "tabela">("kanban")
  const [pracaFilter, setPracaFilter] = useState<string>("")
  const [confFilter, setConfFilter] = useState<string>("")
  const [mesFilter, setMesFilter] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("pendente") // só usado em tabela
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set())
  const [drawerId, setDrawerId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [comentario, setComentario] = useState("")
  const [valorEditado, setValorEditado] = useState<string>("")

  // Sempre busca todas, filtros aplicam client-side (kanban precisa de todos os status)
  const { data, error, isLoading, mutate } = useSWR<{ data: MetaAjusteProposto[] }>(
    `/api/metas/ajustes?status=todos&limit=1000`,
    fetcher,
  )

  const todasPropostas = data?.data ?? []

  // Live data: OTB, meta móvel, ocupação Y/Y, receita Y/Y, diária atual.
  // Buscamos uma vez por (idpropriedade, mes_ano) presente nas propostas.
  // Atualiza no mount e quando o conjunto de propostas muda.
  const [liveByKey, setLiveByKey] = useState<Map<string, LiveEntry>>(new Map())
  const [liveLoading, setLiveLoading] = useState(false)

  const liveSignature = useMemo(
    () =>
      Array.from(
        new Set(todasPropostas.map((p) => liveKey(p.idpropriedade, p.mes_ano))),
      )
        .sort()
        .join("|"),
    [todasPropostas],
  )

  useEffect(() => {
    if (todasPropostas.length === 0) return
    const items = Array.from(
      new Map(
        todasPropostas.map((p) => [
          liveKey(p.idpropriedade, p.mes_ano),
          { idpropriedade: p.idpropriedade, mes_ano: p.mes_ano },
        ]),
      ).values(),
    )
    let cancelled = false
    setLiveLoading(true)
    fetch("/api/metas/ajustes/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j?.results) return
        const next = new Map<string, LiveEntry>()
        for (const r of j.results as LiveEntry[]) {
          next.set(liveKey(r.idpropriedade, r.mes_ano), r)
        }
        setLiveByKey(next)
      })
      .catch((err) => {
        console.error("[metas] live fetch falhou:", err)
      })
      .finally(() => {
        if (!cancelled) setLiveLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSignature])

  // Filtros aplicam em todos os contextos.
  const propostasFiltradas = useMemo(() => {
    return todasPropostas.filter((p) => {
      if (pracaFilter && p.praca !== pracaFilter) return false
      if (confFilter && p.confianca !== confFilter) return false
      if (mesFilter && p.mes_ano !== mesFilter) return false
      return true
    })
  }, [todasPropostas, pracaFilter, confFilter, mesFilter])

  const pracasDisponiveis = useMemo(
    () =>
      Array.from(new Set(todasPropostas.map((p) => p.praca).filter(Boolean))).sort() as string[],
    [todasPropostas],
  )

  const mesesDisponiveis = useMemo(() => {
    const meses = Array.from(new Set(todasPropostas.map((p) => p.mes_ano).filter(Boolean)))
    return meses.sort((a, b) => {
      const [ma, ya] = a.split("/").map(Number)
      const [mb, yb] = b.split("/").map(Number)
      return ya === yb ? ma - mb : ya - yb
    })
  }, [todasPropostas])

  const propostasPorStatus = useMemo(() => {
    const map: Record<StatusProposta, MetaAjusteProposto[]> = {
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

  function applyOptimistic(ids: number[], acao: "aprovar" | "rejeitar") {
    const novoStatus: StatusProposta = acao === "aprovar" ? "aprovado" : "rejeitado"
    const idSet = new Set(ids)
    mutate(
      (current) => {
        if (!current?.data) return current
        return {
          ...current,
          data: current.data.map((p) =>
            idSet.has(p.id) && p.status === "pendente" ? { ...p, status: novoStatus } : p,
          ),
        }
      },
      { revalidate: false },
    )
  }

  function markProcessing(ids: number[], on: boolean) {
    setProcessingIds((prev) => {
      const next = new Set(prev)
      if (on) ids.forEach((id) => next.add(id))
      else ids.forEach((id) => next.delete(id))
      return next
    })
  }

  async function handleDecide(
    id: number,
    acao: "aprovar" | "rejeitar",
    coment?: string | null,
    valor?: number | null,
  ) {
    markProcessing([id], true)
    setSubmitting(true)
    applyOptimistic([id], acao)
    try {
      const res = await fetch(`/api/metas/ajustes/${id}`, {
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
      setDrawerId(null)
      setComentario("")
      setValorEditado("")
      await mutate()
      toast({
        title: acao === "aprovar" ? "Proposta aprovada" : "Proposta rejeitada",
        description: `#${id} • ${STATUS_LABEL[json.data.status as StatusProposta]}`,
      })
    } catch (err) {
      await mutate()
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Falha desconhecida",
        variant: "destructive",
      })
    } finally {
      markProcessing([id], false)
      setSubmitting(false)
    }
  }

  async function handleBulk(acao: "aprovar" | "rejeitar") {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    markProcessing(ids, true)
    setSubmitting(true)
    applyOptimistic(ids, acao)
    try {
      const res = await fetch("/api/metas/ajustes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, acao }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro")

      const processed: number = json.processed ?? 0
      const skippedN: number = json.skipped ?? 0
      const failedN: number = json.failed ?? 0
      const descParts: string[] = []
      if (skippedN > 0) descParts.push(`${skippedN} já decididas`)
      if (failedN > 0) descParts.push(`${failedN} falharam`)

      setSelected(new Set())
      await mutate()
      toast({
        title: `${processed} ${acao === "aprovar" ? "aprovadas" : "rejeitadas"}`,
        description: descParts.length > 0 ? descParts.join(" · ") : undefined,
        variant: failedN > 0 ? "destructive" : undefined,
      })
    } catch (err) {
      await mutate()
      toast({
        title: "Erro ao processar em lote",
        description: err instanceof Error ? err.message : "Falha desconhecida",
        variant: "destructive",
      })
    } finally {
      markProcessing(ids, false)
      setSubmitting(false)
    }
  }

  const showBulk = userIsApprover && selected.size > 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Ajustes de Metas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Propostas mensais para o mês corrente e próximos 3 meses, geradas automaticamente.
            {!userIsApprover && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" /> Modo somente leitura
              </span>
            )}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <KpiCards propostas={propostasFiltradas} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-1">Pendentes por praça</div>
            <div className="text-xs text-muted-foreground mb-2">Top 6, divididas por direção do ajuste</div>
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
            <div className="text-sm font-medium mb-1">Pendentes por mês alvo</div>
            <div className="text-xs text-muted-foreground mb-2">Distribuição entre M+1, M+2 e M+3</div>
            <DistribuicaoPorMes propostas={propostasFiltradas} />
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
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
              <Select value={pracaFilter || "all"} onValueChange={(v) => setPracaFilter(v === "all" ? "" : v)}>
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
              <Label className="text-xs">Mês-alvo</Label>
              <Select value={mesFilter || "all"} onValueChange={(v) => setMesFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {mesesDisponiveis.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Confiança</Label>
              <Select value={confFilter || "all"} onValueChange={(v) => setConfFilter(v === "all" ? "" : v)}>
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

      {/* Loading / error */}
      {isLoading && <TableSkeleton rows={8} />}
      {error && (
        <div className="text-center py-8 text-red-600">Erro ao carregar propostas</div>
      )}

      {/* View */}
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
                    processingIds={processingIds}
                    onCardClick={setDrawerId}
                    onSelectChange={toggleSelect}
                    selectable={userIsApprover}
                    dndEnabled={userIsApprover}
                    liveByKey={liveByKey}
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

      {/* Drawer */}
      <Sheet open={drawerId !== null} onOpenChange={(o) => !o && setDrawerId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
          {dropOpen && (
            <div className="flex flex-col h-full">
              <SheetHeader className="px-6 pt-6 pb-4 border-b">
                <SheetTitle className="text-base leading-tight pr-6">
                  {dropOpen.nomepropriedade ?? dropOpen.idpropriedade}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {dropOpen.praca ?? "—"} • {dropOpen.grupo_nome ?? "—"} • {dropOpen.mes_ano}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* Metas */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Meta atual</div>
                    <div className="text-lg font-semibold tabular-nums mt-0.5">
                      {fmtBRL(dropOpen.meta_atual)}
                    </div>
                    {dropOpen.diaria_unidade_12m && Number(dropOpen.diaria_unidade_12m) > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        ≈{" "}
                        {Math.ceil(
                          Number(dropOpen.meta_atual) / Number(dropOpen.diaria_unidade_12m),
                        )}{" "}
                        noites a {fmtBRL(dropOpen.diaria_unidade_12m)}
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Meta sugerida</div>
                    <div className="text-lg font-semibold tabular-nums mt-0.5">
                      {fmtBRL(dropOpen.meta_sugerida)}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                      <DeltaBadge delta={Number(dropOpen.delta_pct)} />
                      {dropOpen.piso_aplicado && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                          title={
                            dropOpen.piso_motivo === "ano_passado_20pct"
                              ? "Piso aplicado: 20% do realizado mesmo mês ano passado"
                              : "Piso aplicado: 6 noites × diária média (12m)"
                          }
                        >
                          piso ativo
                        </span>
                      )}
                    </div>
                    {dropOpen.diaria_unidade_12m && Number(dropOpen.diaria_unidade_12m) > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        ≈{" "}
                        {Math.ceil(
                          Number(dropOpen.meta_sugerida) / Number(dropOpen.diaria_unidade_12m),
                        )}{" "}
                        noites a {fmtBRL(dropOpen.diaria_unidade_12m)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Pace atual (dados brutos do mês alvo) — atualizado diariamente via BQ */}
                {(() => {
                  const liveRow = liveByKey.get(liveKey(dropOpen.idpropriedade, dropOpen.mes_ano))
                  const otbDisplay = liveRow?.otb_atual ?? dropOpen.otb_alvo
                  const mmDisplay = liveRow?.meta_movel_atual ?? dropOpen.meta_movel_alvo
                  const ratio =
                    mmDisplay && Number(mmDisplay) > 0
                      ? (Number(otbDisplay ?? 0) / Number(mmDisplay)) * 100
                      : null
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium">Pace atual de {dropOpen.mes_ano}</div>
                        {liveRow ? (
                          <span className="text-[10px] text-muted-foreground" title={liveRow.atualizado_em}>
                            atualizado{" "}
                            {format(new Date(liveRow.atualizado_em), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        ) : liveLoading ? (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> sincronizando
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border p-3">
                          <div className="text-xs text-muted-foreground" title="Reservas já criadas (não-canceladas) com checkout no mês alvo — recalculado a cada acesso.">
                            OTB atual
                          </div>
                          <div className="text-lg font-semibold tabular-nums mt-0.5">
                            {fmtBRL(otbDisplay)}
                          </div>
                        </div>
                        <div className="rounded-lg border p-3">
                          <div className="text-xs text-muted-foreground" title="Quanto deveria estar bookado para o mês alvo até hoje (warehouse.meta_e_meta_movel_checkout) — recalculado a cada acesso.">
                            Meta móvel atual
                          </div>
                          <div className="text-lg font-semibold tabular-nums mt-0.5">
                            {fmtBRL(mmDisplay)}
                          </div>
                          {ratio != null && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {ratio.toFixed(0)}% do esperado
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Sinais */}
                <div>
                  <div className="text-sm font-medium mb-2">Sinais</div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <span
                        className="text-muted-foreground"
                        title="OTB (reservas já bookadas) do mês alvo ÷ meta móvel do mês alvo, projetado sobre a meta atual."
                      >
                        Meta móvel
                      </span>
                      <span className="tabular-nums">{fmtBRL(dropOpen.sinal_meta_movel)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span
                        className="text-muted-foreground"
                        title="Realizado no mesmo mês do ano passado (próprio ou mediana do grupo) +10%. Quando o realizado próprio é R$ 0, o motor cai para a mediana do grupo — o rótulo 'Histórico próprio' na justificativa pode estar enganando."
                      >
                        Histórico ano passado
                      </span>
                      <span className="tabular-nums">{fmtBRL(dropOpen.sinal_ano_passado)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span
                        className="text-muted-foreground"
                        title="Mediana das metas atuais de unidades do mesmo grupo + nº de quartos para o mesmo mês."
                      >
                        Mediana do grupo
                      </span>
                      <span className="tabular-nums">{fmtBRL(dropOpen.sinal_similares)}</span>
                    </div>
                    {/* Aviso: quando receita Y-1 real (BQ) é ~0 mas sinal_ano_passado >> 0,
                        o motor caiu para a mediana do grupo. Justificativa "Histórico próprio" pode confundir. */}
                    {(() => {
                      const liveRow = liveByKey.get(liveKey(dropOpen.idpropriedade, dropOpen.mes_ano))
                      const realYp = Number(liveRow?.receita_ano_passado ?? NaN)
                      const sinalYp = Number(dropOpen.sinal_ano_passado ?? NaN)
                      if (!Number.isFinite(realYp) || !Number.isFinite(sinalYp)) return null
                      if (sinalYp <= 0) return null
                      // Considera "próprio = 0" quando realizado real Y-1 é < 5% do sinal.
                      const proprioZerado = realYp <= Math.max(50, sinalYp * 0.05)
                      if (!proprioZerado) return null
                      return (
                        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-900 px-3 py-2 text-amber-900 dark:text-amber-200 text-xs">
                          ⚠️ A unidade ficou zerada em {(() => {
                            const [mm, yyyy] = dropOpen.mes_ano.split("/")
                            return `${mm}/${Number(yyyy) - 1}`
                          })()} (receita real ≈ {fmtBRL(realYp)}). O valor de "histórico ano passado"
                          acima ({fmtBRL(sinalYp)}) é a mediana do grupo, não a receita própria.
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Justificativa */}
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

                {/* Status / metadata */}
                <div className="text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={dropOpen.status} />
                    {dropOpen.confianca && <ConfBadge c={dropOpen.confianca} />}
                  </div>
                  <div className="mt-2">
                    Criada em{" "}
                    {format(new Date(dropOpen.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    {dropOpen.aprovado_por && (
                      <>
                        {" "}• Decidida por {dropOpen.aprovado_por}
                        {dropOpen.aprovado_em &&
                          ` em ${format(new Date(dropOpen.aprovado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}`}
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
                        placeholder={String(dropOpen.meta_sugerida)}
                        value={valorEditado}
                        onChange={(e) => setValorEditado(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Deixe vazio para usar a meta sugerida ({fmtBRL(dropOpen.meta_sugerida)}).
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
