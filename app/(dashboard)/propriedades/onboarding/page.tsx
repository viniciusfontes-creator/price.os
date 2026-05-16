"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, AlertCircle, Workflow } from "lucide-react"
import type { OnboardingCard, OnboardingState } from "@/app/api/onboarding/route"

// ============================================
// Configuração das colunas
// ============================================

interface ColumnConfig {
    state: OnboardingState
    label: string
    helper: string
    dot: string
}

const COLUMNS: ColumnConfig[] = [
    { state: "recebida", label: "Recebida", helper: "Aguardando enriquecimento", dot: "bg-[#8e8e93]" },
    { state: "em_analise", label: "Em Análise", helper: "Pipeline em execução", dot: "bg-[#007aff]" },
    { state: "estudo_pronto", label: "Estudo Pronto", helper: "PDF gerado e enviado", dot: "bg-[#5ac8fa]" },
    { state: "apresentado", label: "Apresentado", helper: "Pitchdeck e e-mail enviados", dot: "bg-[#af52de]" },
    { state: "aguardando_aprovacao", label: "Aguardando Aprovação", helper: "Operador revisa sugestões", dot: "bg-[#ff9500]" },
    { state: "ativada", label: "Ativada", helper: "Visível nas Views", dot: "bg-[#34c759]" },
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
// Card
// ============================================

function OnboardingCardItem({ card }: { card: OnboardingCard }) {
    const payload = card.jestor_payload || {}
    const titulo = payload.rotulo || payload.propriedade || card.idpropriedade
    const proprietario = card.owner_name || payload.proprietario
    const localidade = payload.localidade

    return (
        <Link href={`/propriedades/onboarding/${card.id}`} className="block group">
            <article
                className="rounded-xl border border-black/[0.06] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-black/[0.12] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 dark:border-white/[0.08] dark:bg-zinc-900 dark:hover:border-white/[0.16]"
                style={{ fontFeatureSettings: '"cv11"' }}
            >
                <div className="space-y-2.5">
                    {/* Title */}
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

                    {/* Meta */}
                    {(proprietario || localidade) && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#515154] dark:text-zinc-400">
                            {proprietario && <span className="truncate max-w-[160px]">{proprietario}</span>}
                            {proprietario && localidade && <span className="text-[#c7c7cc]">·</span>}
                            {localidade && <span>{localidade}</span>}
                        </div>
                    )}

                    {/* KPIs (only when present) */}
                    {(card.property_value != null || card.meta_anual != null) && (
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

                    {/* Footer */}
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
    )
}

// ============================================
// Coluna
// ============================================

function KanbanColumn({ config, cards }: { config: ColumnConfig; cards: OnboardingCard[] }) {
    return (
        <section className="flex flex-col w-[300px] shrink-0">
            <header className="px-1 pb-3">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden />
                    <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-[#1d1d1f] dark:text-zinc-100">
                        {config.label}
                    </h3>
                    <span className="ml-auto text-[11px] tabular-nums text-[#86868b]">
                        {cards.length}
                    </span>
                </div>
                <p className="text-[11px] text-[#86868b] leading-snug">{config.helper}</p>
            </header>

            <div className="flex flex-col gap-2 min-h-[120px]">
                {cards.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-[11px] text-[#c7c7cc]">
                        Vazia
                    </div>
                ) : (
                    cards.map((c) => <OnboardingCardItem key={c.id} card={c} />)
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

    const ativeTotal = data
        ? data.total - (data.counts.ativada || 0) - (data.counts.arquivada || 0)
        : 0

    return (
        <div className="flex flex-col h-[calc(100vh-7rem)] -m-6 bg-[#fafafa] dark:bg-zinc-950">
            {/* Toolbar com vibrancy */}
            <div className="sticky top-0 z-10 px-8 py-5 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:bg-zinc-950/80 dark:border-white/[0.06]">
                <div className="flex items-end justify-between">
                    <div>
                        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1d1d1f] dark:text-zinc-100">
                            Onboarding
                        </h1>
                        <p className="text-[13px] text-[#86868b] mt-0.5">
                            Funil de unidades novas — recebimento, análise, apresentação e ativação.
                        </p>
                    </div>
                    {data && (
                        <div className="flex items-center gap-6 text-[12px] tabular-nums">
                            <Metric label="Em andamento" value={ativeTotal} />
                            <Metric label="Ativadas" value={data.counts.ativada || 0} accent="#34c759" />
                            <Metric label="Arquivadas" value={data.counts.arquivada || 0} accent="#8e8e93" />
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-5 w-5 animate-spin text-[#8e8e93]" />
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-[#86868b]">
                        <AlertCircle className="h-7 w-7 text-[#ff3b30]" />
                        <p className="text-sm">{error}</p>
                    </div>
                ) : data && data.total === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="h-full overflow-x-auto">
                        <div className="flex gap-5 px-8 py-6 h-full min-w-max">
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
                                        helper: "Descartados",
                                        dot: "bg-[#c7c7cc]",
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

function Metric({ label, value, accent }: { label: string; value: number; accent?: string }) {
    return (
        <div className="flex flex-col items-end">
            <span
                className="text-[18px] font-semibold tabular-nums"
                style={{ color: accent || "#1d1d1f" }}
            >
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
                    Os cards aparecem aqui automaticamente quando o operador da Jestor clica no botão
                    de precificação. Cada propriedade nova entra em <strong className="text-[#1d1d1f] dark:text-zinc-100">Recebida</strong>
                    {" "}e avança no funil conforme o pipeline processa.
                </p>
            </div>
            <code className="text-[11px] text-[#86868b] border border-black/[0.06] rounded-md px-2.5 py-1 bg-white font-mono dark:border-white/[0.08] dark:bg-zinc-900">
                POST /api/onboarding/webhook
            </code>
        </div>
    )
}
