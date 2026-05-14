"use client"

import * as React from "react"
import {
    Workflow,
    Loader2,
    AlertCircle,
    Inbox,
    Cog,
    FileCheck2,
    Send,
    UserCheck,
    CheckCircle2,
    Archive,
    User,
    MapPin,
    Hash,
    Clock,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { OnboardingCard, OnboardingState } from "@/app/api/onboarding/route"

// ============================================
// Configuração visual das colunas do Kanban
// ============================================

interface ColumnConfig {
    state: OnboardingState
    label: string
    description: string
    icon: typeof Workflow
    accent: string
}

const COLUMNS: ColumnConfig[] = [
    {
        state: "recebida",
        label: "Recebida",
        description: "Webhook da Jestor acabou de chegar",
        icon: Inbox,
        accent: "bg-slate-500",
    },
    {
        state: "em_analise",
        label: "Em Análise",
        description: "Pipeline rodando (BQ + Gemini + cálculos)",
        icon: Cog,
        accent: "bg-blue-500",
    },
    {
        state: "estudo_pronto",
        label: "Estudo Pronto",
        description: "Estudo de Rentabilidade gerado",
        icon: FileCheck2,
        accent: "bg-cyan-500",
    },
    {
        state: "apresentado",
        label: "Apresentado",
        description: "Pitchdeck e e-mail enviados ao proprietário",
        icon: Send,
        accent: "bg-violet-500",
    },
    {
        state: "aguardando_aprovacao",
        label: "Aguardando Aprovação",
        description: "Operador revisa sugestões finais",
        icon: UserCheck,
        accent: "bg-amber-500",
    },
    {
        state: "ativada",
        label: "Ativada",
        description: "Unidade liberada nas Views",
        icon: CheckCircle2,
        accent: "bg-emerald-500",
    },
]

// ============================================
// Helpers
// ============================================

function formatRelative(iso: string): string {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return "agora"
    if (diffMin < 60) return `há ${diffMin}min`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `há ${diffH}h`
    const diffD = Math.floor(diffH / 24)
    if (diffD < 30) return `há ${diffD}d`
    return date.toLocaleDateString("pt-BR")
}

function formatBRL(v: number | null | undefined): string {
    if (v == null) return "—"
    return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
}

// ============================================
// Card individual
// ============================================

function OnboardingCardItem({ card }: { card: OnboardingCard }) {
    const payload = card.jestor_payload || {}
    const titulo = payload.rotulo || payload.propriedade || card.idpropriedade
    const proprietario = card.owner_name || payload.proprietario || "—"
    const localidade = payload.localidade || "—"

    return (
        <Card className="p-3 hover:border-foreground/20 transition-colors cursor-pointer space-y-2">
            <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-medium leading-tight line-clamp-2">{titulo}</h4>
                <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                    {card.idpropriedade}
                </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {localidade}
                </span>
                <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> {proprietario}
                </span>
                {card.jestor_record_id && (
                    <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" /> {card.jestor_record_id}
                    </span>
                )}
            </div>

            {(card.property_value != null || card.meta_anual != null) && (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t text-xs">
                    <div>
                        <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
                            Valor Imóvel
                        </div>
                        <div className="font-medium">{formatBRL(card.property_value)}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
                            Meta Anual
                        </div>
                        <div className="font-medium">{formatBRL(card.meta_anual)}</div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatRelative(card.created_at)}
                </span>
                {card.operator_email && (
                    <span className="truncate max-w-[100px]" title={card.operator_email}>
                        {card.operator_email.split("@")[0]}
                    </span>
                )}
            </div>
        </Card>
    )
}

// ============================================
// Coluna do Kanban
// ============================================

function KanbanColumn({
    config,
    cards,
}: {
    config: ColumnConfig
    cards: OnboardingCard[]
}) {
    const Icon = config.icon
    return (
        <div className="flex flex-col w-[280px] shrink-0 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b">
                <span className={cn("h-2 w-2 rounded-full", config.accent)} />
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-sm font-medium flex-1">{config.label}</h3>
                <Badge variant="secondary" className="text-[10px] h-5">
                    {cards.length}
                </Badge>
            </div>
            <p className="px-3 pt-2 text-[11px] text-muted-foreground leading-snug">
                {config.description}
            </p>
            <div className="flex flex-col gap-2 p-2 overflow-y-auto flex-1 min-h-[200px]">
                {cards.length === 0 ? (
                    <div className="flex items-center justify-center text-[11px] text-muted-foreground/60 py-8">
                        Nenhum item
                    </div>
                ) : (
                    cards.map((c) => <OnboardingCardItem key={c.id} card={c} />)
                )}
            </div>
        </div>
    )
}

// ============================================
// Página principal
// ============================================

export default function OnboardingKanbanPage() {
    const [data, setData] = React.useState<{
        by_state: Record<OnboardingState, OnboardingCard[]>
        counts: Record<OnboardingState, number>
        total: number
    } | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        fetch("/api/onboarding")
            .then((r) => r.json())
            .then((j) => {
                if (!j.success) {
                    setError(j.error || "Falha ao carregar")
                    return
                }
                const total = (j.data || []).length
                setData({ by_state: j.by_state, counts: j.counts, total })
            })
            .catch((e) => setError(String(e)))
            .finally(() => setLoading(false))
    }, [])

    return (
        <div className="flex flex-col h-[calc(100vh-7rem)] -m-6">
            {/* Header */}
            <div className="px-6 py-4 border-b bg-background">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold flex items-center gap-2">
                            <Workflow className="h-6 w-6 text-sky-500" />
                            Onboarding de Propriedades
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Funil de unidades novas vindas da Jestor — do recebimento até a ativação no Price.OS.
                        </p>
                    </div>
                    {data && (
                        <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Total ativo:</span>
                                <Badge variant="secondary">
                                    {data.total - (data.counts.ativada || 0) - (data.counts.arquivada || 0)}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Ativadas:</span>
                                <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                                    {data.counts.ativada || 0}
                                </Badge>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                        <AlertCircle className="h-8 w-8 text-destructive" />
                        <p className="text-sm">{error}</p>
                    </div>
                ) : data && data.total === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="h-full overflow-x-auto">
                        <div className="flex gap-3 p-4 h-full min-w-max">
                            {COLUMNS.map((col) => (
                                <KanbanColumn
                                    key={col.state}
                                    config={col}
                                    cards={data?.by_state[col.state] || []}
                                />
                            ))}
                            {data && data.counts.arquivada > 0 && (
                                <KanbanColumn
                                    config={{
                                        state: "arquivada",
                                        label: "Arquivada",
                                        description: "Onboardings descartados pelo operador",
                                        icon: Archive,
                                        accent: "bg-zinc-400",
                                    }}
                                    cards={data.by_state.arquivada || []}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6 py-12">
            <div className="rounded-full bg-muted p-4">
                <Workflow className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1 max-w-md">
                <h3 className="text-base font-medium">Nenhum onboarding em andamento</h3>
                <p className="text-sm text-muted-foreground">
                    Cards aparecem aqui automaticamente quando o operador da Jestor clica no botão de
                    precificação. Cada propriedade nova entra na coluna <strong>Recebida</strong> e
                    avança no funil conforme o pipeline processa os artefatos.
                </p>
            </div>
            <div className="text-xs text-muted-foreground border rounded-md px-3 py-2 font-mono bg-muted/40">
                POST /api/onboarding/webhook
            </div>
        </div>
    )
}
