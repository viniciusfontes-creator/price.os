"use client"

import * as React from "react"
import Link from "next/link"
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    useDraggable,
    useDroppable,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core"
import { Loader2, AlertCircle, Workflow, Sparkles, Inbox, Cpu, Eye, ShieldCheck, CheckCircle2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { OnboardingCard, OnboardingState } from "@/app/api/onboarding/route"
import { canTransitionManually, transitionReason } from "@/lib/onboarding/transitions"

// ============================================
// Configuração das colunas
// ============================================

interface ColumnConfig {
    state: OnboardingState
    label: string
    helper: string
    dot: string
    Icon: typeof Inbox
}

const COLUMNS: ColumnConfig[] = [
    { state: "fila", label: "Fila", helper: "Aguardando processamento", dot: "bg-[#8e8e93]", Icon: Inbox },
    { state: "processamento_ia", label: "Processamento IA", helper: "Pipeline em execução (~30-60s)", dot: "bg-[#007aff]", Icon: Cpu },
    { state: "revisao", label: "Revisão", helper: "Operador revisa por até 48h", dot: "bg-[#5ac8fa]", Icon: Eye },
    { state: "aprovacao", label: "Aprovação", helper: "Vitor aprova ou solicita alterações", dot: "bg-[#ff9500]", Icon: ShieldCheck },
    { state: "concluido", label: "Concluído", helper: "E-mail + Slack disparados, unidade ativa", dot: "bg-[#34c759]", Icon: CheckCircle2 },
]

// ============================================
// Helpers
// ============================================

function formatRelative(iso: string): string {
    const date = new Date(iso)
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000)
    if (diffMin < 1) return "agora"
    if (diffMin < 60) return `${diffMin}m`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h`
    const diffD = Math.floor(diffH / 24)
    if (diffD < 30) return `${diffD}d`
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

function formatBRL(v: number | null | undefined): string {
    if (v == null) return "—"
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`
    return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
}

// ============================================
// Card draggable
// ============================================

function CardItem({ card }: { card: OnboardingCard }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: card.id,
        data: { card },
    })

    const payload = card.jestor_payload || {}
    const titulo = payload.rotulo || payload.propriedade || card.idpropriedade
    const proprietario = card.owner_name || payload.proprietario
    const localidade = payload.localidade

    // Em processamento_ia, mostra mini progress baseado em event types
    const isProcessing = card.state === "processamento_ia"

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            style={{ opacity: isDragging ? 0.4 : 1 }}
            className="block group touch-none"
        >
            <Link href={`/propriedades/onboarding/${card.id}`} draggable={false} onClick={(e) => e.stopPropagation()}>
                <article
                    className="rounded-xl border border-black/[0.06] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-black/[0.12] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 cursor-grab active:cursor-grabbing dark:border-white/[0.08] dark:bg-zinc-900 dark:hover:border-white/[0.16]"
                    style={{ fontFeatureSettings: '"cv11"' }}
                >
                    <div className="space-y-2.5">
                        <div className="space-y-1">
                            <h4 className="text-[13px] font-semibold leading-tight text-[#1d1d1f] line-clamp-2 tracking-[-0.01em] dark:text-zinc-100">
                                {titulo}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[10.5px] text-[#86868b] tabular-nums">
                                <span className="font-mono uppercase tracking-wide">{card.idpropriedade}</span>
                                {card.jestor_record_id && (
                                    <>
                                        <span aria-hidden>·</span>
                                        <span className="font-mono">#{card.jestor_record_id}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {(proprietario || localidade) && (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#515154] dark:text-zinc-400">
                                {proprietario && <span className="truncate max-w-[180px]">{proprietario}</span>}
                                {proprietario && localidade && <span className="text-[#c7c7cc]">·</span>}
                                {localidade && <span>{localidade}</span>}
                            </div>
                        )}

                        {isProcessing && <ProcessingProgress />}

                        {!isProcessing && (card.property_value != null || card.meta_anual != null) && (
                            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-black/[0.05] dark:border-white/[0.06]">
                                <div>
                                    <div className="text-[9.5px] uppercase tracking-[0.08em] text-[#86868b] font-medium">
                                        Imóvel
                                    </div>
                                    <div className="text-[12.5px] font-semibold tabular-nums text-[#1d1d1f] dark:text-zinc-100">
                                        {formatBRL(card.property_value)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[9.5px] uppercase tracking-[0.08em] text-[#86868b] font-medium">
                                        Meta
                                    </div>
                                    <div className="text-[12.5px] font-semibold tabular-nums text-[#007aff]">
                                        {formatBRL(card.meta_anual)}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-[#86868b] tabular-nums pt-0.5">
                            <span>{formatRelative(card.created_at)}</span>
                            {card.operator_email && (
                                <span className="truncate max-w-[110px]" title={card.operator_email}>
                                    {card.operator_email.split("@")[0]}
                                </span>
                            )}
                        </div>
                    </div>
                </article>
            </Link>
        </div>
    )
}

function ProcessingProgress() {
    return (
        <div className="flex items-center gap-1.5 pt-1.5 border-t border-black/[0.05] dark:border-white/[0.06]">
            <Sparkles className="h-3 w-3 text-[#007aff] animate-pulse" strokeWidth={2.5} />
            <span className="text-[10.5px] font-medium text-[#007aff]">IA processando…</span>
            <div className="ml-auto flex gap-0.5">
                <span className="h-1 w-1 rounded-full bg-[#007aff] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1 w-1 rounded-full bg-[#007aff] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1 w-1 rounded-full bg-[#007aff] animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
        </div>
    )
}

// ============================================
// Coluna droppable
// ============================================

function Column({
    config,
    cards,
    activeFrom,
}: {
    config: ColumnConfig
    cards: OnboardingCard[]
    activeFrom: OnboardingState | null
}) {
    const allowed = activeFrom == null || canTransitionManually(activeFrom, config.state) || activeFrom === config.state
    const isSourceColumn = activeFrom === config.state
    const reason = activeFrom && !allowed ? transitionReason(activeFrom, config.state) : null

    const { setNodeRef, isOver } = useDroppable({
        id: `col-${config.state}`,
        data: { state: config.state },
        disabled: !allowed || isSourceColumn,
    })

    const Icon = config.Icon

    return (
        <section className="flex flex-col w-[300px] shrink-0">
            <header className="px-1 pb-3">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden />
                    <Icon className="h-3.5 w-3.5 text-[#86868b]" strokeWidth={2} />
                    <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-[#1d1d1f] dark:text-zinc-100">
                        {config.label}
                    </h3>
                    <span className="ml-auto text-[11px] tabular-nums text-[#86868b]">{cards.length}</span>
                </div>
                <p className="text-[11px] text-[#86868b] leading-snug">{config.helper}</p>
            </header>

            <div
                ref={setNodeRef}
                className={`flex flex-col gap-2 min-h-[160px] rounded-xl p-1 transition-colors duration-150 ${
                    isOver && allowed ? "bg-[#007aff]/8 ring-2 ring-[#007aff]/30" : ""
                } ${activeFrom && !allowed && !isSourceColumn ? "opacity-40" : ""}`}
                title={reason || undefined}
            >
                {cards.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-[11px] text-[#c7c7cc]">
                        {isOver && allowed ? "Soltar aqui" : "Vazia"}
                    </div>
                ) : (
                    cards.map((c) => <CardItem key={c.id} card={c} />)
                )}
            </div>
        </section>
    )
}

// ============================================
// Página
// ============================================

export default function OnboardingKanbanPage() {
    const [data, setData] = React.useState<{
        by_state: Record<OnboardingState, OnboardingCard[]>
        counts: Record<OnboardingState, number>
        total: number
    } | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [activeCard, setActiveCard] = React.useState<OnboardingCard | null>(null)
    const [toast, setToast] = React.useState<{ kind: "ok" | "err"; msg: string } | null>(null)

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

    const reload = React.useCallback(() => {
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

    React.useEffect(() => {
        reload()
        // Auto-refresh leve a cada 15s para refletir avanço do pipeline
        const t = setInterval(reload, 15000)
        return () => clearInterval(t)
    }, [reload])

    React.useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    function onDragStart(ev: DragStartEvent) {
        const card = ev.active.data.current?.card as OnboardingCard | undefined
        if (card) setActiveCard(card)
    }

    async function onDragEnd(ev: DragEndEvent) {
        const card = ev.active.data.current?.card as OnboardingCard | undefined
        setActiveCard(null)
        if (!card || !ev.over) return

        const toState = ev.over.data.current?.state as OnboardingState | undefined
        if (!toState || toState === card.state) return

        if (!canTransitionManually(card.state, toState)) {
            const reason = transitionReason(card.state, toState) || `Não pode ir de ${card.state} para ${toState}`
            setToast({ kind: "err", msg: reason })
            return
        }

        // Otimista: move localmente
        setData((prev) => {
            if (!prev) return prev
            const by_state = { ...prev.by_state }
            by_state[card.state] = by_state[card.state].filter((c) => c.id !== card.id)
            by_state[toState] = [{ ...card, state: toState }, ...(by_state[toState] || [])]
            return { ...prev, by_state }
        })

        const res = await fetch(`/api/onboarding/${card.id}/transition`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: toState }),
        })
        const j = await res.json()
        if (!res.ok) {
            setToast({ kind: "err", msg: j.reason || j.error || "Falha" })
            reload() // reverte otimista
        } else {
            const msg =
                toState === "concluido"
                    ? "Concluído — e-mail, Slack e Jestor disparados"
                    : toState === "processamento_ia"
                    ? "Pipeline disparado em background"
                    : "Movido"
            setToast({ kind: "ok", msg })
            reload()
        }
    }

    const ativeTotal = data
        ? data.total - (data.counts.concluido || 0) - (data.counts.arquivada || 0)
        : 0

    return (
        <div className="flex flex-col h-[calc(100vh-7rem)] -m-6 bg-[#fafafa] dark:bg-zinc-950">
            <div className="sticky top-0 z-10 px-8 py-5 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:bg-zinc-950/80 dark:border-white/[0.06]">
                <div className="flex items-end justify-between">
                    <div>
                        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1d1d1f] dark:text-zinc-100">
                            Onboarding
                        </h1>
                        <p className="text-[13px] text-[#86868b] mt-0.5">
                            Arraste cards entre colunas para mover. Transições inválidas ficam esmaecidas.
                        </p>
                    </div>
                    {data && (
                        <div className="flex items-center gap-6 text-[12px] tabular-nums">
                            <Metric label="Em andamento" value={ativeTotal} />
                            <Metric label="Concluídas" value={data.counts.concluido || 0} accent="#34c759" />
                            <Metric label="Arquivadas" value={data.counts.arquivada || 0} accent="#8e8e93" />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {loading ? (
                    <div className="h-full overflow-x-auto animate-in fade-in duration-500">
                        <div className="flex gap-5 px-8 py-6 h-full min-w-max">
                            {[...Array(5)].map((_, col) => (
                                <div key={col} className="flex flex-col gap-3 min-w-[280px]">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Skeleton className="h-4 w-4 rounded" />
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-4 w-6 rounded-full ml-auto" />
                                    </div>
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="bg-card rounded-lg border p-3 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Skeleton className="h-4 w-16" />
                                                <Skeleton className="h-3 w-3 rounded-full ml-auto" />
                                            </div>
                                            <Skeleton className="h-5 w-3/4" />
                                            <Skeleton className="h-3 w-1/2" />
                                            <div className="flex justify-between pt-1">
                                                <Skeleton className="h-3 w-20" />
                                                <Skeleton className="h-3 w-12" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-[#86868b]">
                        <AlertCircle className="h-7 w-7 text-[#ff3b30]" />
                        <p className="text-sm">{error}</p>
                    </div>
                ) : data && data.total === 0 ? (
                    <EmptyState />
                ) : (
                    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
                        <div className="h-full overflow-x-auto">
                            <div className="flex gap-5 px-8 py-6 h-full min-w-max">
                                {COLUMNS.map((col) => (
                                    <Column
                                        key={col.state}
                                        config={col}
                                        cards={data?.by_state[col.state] || []}
                                        activeFrom={activeCard?.state || null}
                                    />
                                ))}
                                {data && data.counts.arquivada > 0 && (
                                    <Column
                                        config={{
                                            state: "arquivada",
                                            label: "Arquivada",
                                            helper: "Descartados",
                                            dot: "bg-[#c7c7cc]",
                                            Icon: Workflow,
                                        }}
                                        cards={data.by_state.arquivada || []}
                                        activeFrom={activeCard?.state || null}
                                    />
                                )}
                            </div>
                        </div>

                        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.16,1,0.3,1)" }}>
                            {activeCard ? (
                                <div className="rotate-2 scale-105 shadow-2xl rounded-xl bg-white p-3.5 border border-black/[0.12] w-[280px]">
                                    <div className="text-[13px] font-semibold text-[#1d1d1f] line-clamp-2">
                                        {activeCard.jestor_payload?.rotulo || activeCard.jestor_payload?.propriedade || activeCard.idpropriedade}
                                    </div>
                                    <div className="text-[10.5px] text-[#86868b] mt-1 font-mono">{activeCard.idpropriedade}</div>
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                )}
            </div>

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-2 fade-in">
                    <div
                        className={`px-4 py-2.5 rounded-full backdrop-blur-xl border text-[12.5px] font-medium shadow-lg ${
                            toast.kind === "ok"
                                ? "bg-[#34c759]/95 border-[#34c759] text-white"
                                : "bg-[#ff3b30]/95 border-[#ff3b30] text-white"
                        }`}
                    >
                        {toast.msg}
                    </div>
                </div>
            )}
        </div>
    )
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: string }) {
    return (
        <div className="flex flex-col items-end">
            <span className="text-[18px] font-semibold tabular-nums" style={{ color: accent || "#1d1d1f" }}>
                {value}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-[#86868b]">{label}</span>
        </div>
    )
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-6 py-12">
            <div className="rounded-2xl bg-[#f2f2f7] p-5 dark:bg-zinc-800">
                <Workflow className="h-7 w-7 text-[#8e8e93]" strokeWidth={1.5} />
            </div>
            <div className="space-y-2 max-w-md">
                <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-[#1d1d1f] dark:text-zinc-100">
                    Nenhum onboarding em andamento
                </h3>
                <p className="text-[13px] text-[#86868b] leading-relaxed">
                    Cards aparecem aqui quando o operador da Jestor clica no botão de precificação.
                </p>
            </div>
        </div>
    )
}
