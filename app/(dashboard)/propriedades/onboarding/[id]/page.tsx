"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
    ChevronLeft,
    Loader2,
    AlertCircle,
    RefreshCw,
    Archive,
    User,
    Mail,
    Phone,
    Activity,
    FileText,
    Send,
    Sparkles,
    ExternalLink,
    CheckCircle2,
    Check,
    Pencil,
    Info,
    DollarSign,
} from "lucide-react"
import { PricingTab } from "@/components/onboarding/pricing-tab"

// ============================================
// Tipos
// ============================================

interface OnboardingDetail {
    id: string
    idpropriedade: string
    jestor_record_id: string | null
    jestor_payload: {
        propriedade?: string
        rotulo?: string
        proprietario?: string
        localidade?: string
        quartos?: string | number
        [k: string]: unknown
    }
    state: string
    bq_snapshot: Record<string, unknown> | null
    similar_properties: { items?: unknown[] } | null
    property_value: number | null
    property_appreciation: number | null
    meta_anual: number | null
    meta_distribuicao_mensal: { items?: MetaMensal[] } | null
    analise_financeira: AnaliseFinanceira | null
    pdf_url: string | null
    owner_name: string | null
    owner_email: string | null
    owner_phone: string | null
    owner_email_sent_at: string | null
    pitchdeck_pdf_url: string | null
    pitchdeck_generated_at: string | null
    suggested_baserate: number | null
    suggested_basket: { items?: BasketItem[]; raio_km?: number; hospedes_alvo?: number } | null
    suggested_sazonalidades: {
        seasonality_name?: string | null
        praca?: string
        periods?: Array<{ percent: number | null; expected_nights: number | null }>
    } | null
    matched_airbnb_listing: string | null
    notes: string | null
    operator_email: string | null
    created_at: string
    enriched_at: string | null
    activated_at: string | null
}

interface OnboardingEvent {
    id: string
    event_type: string
    payload: Record<string, unknown> | null
    created_at: string
}

interface BasketItem {
    id_numerica: number
    nome_anuncio: string | null
    url_anuncio: string | null
    distancia_km: number | null
    preco_por_noite: number | null
    hospedes_adultos: number | null
}

interface MetaMensal {
    mes: string
    meta_faturamento: number
    meta_noites_2026: number
    meta_diaria_media: number
    feriado?: { nome: string; faturamento_feriado: number; diaria_media_feriado?: number; noites_feriado?: number } | null
    feriados?: Array<{
        nome: string
        faturamento_feriado: number
        diaria_media_feriado: number
        noites_feriado: number
    }>
    nao_feriado?: {
        noites_nao_feriado: number
        faturamento_nao_feriado: number
        diaria_media_nao_feriado: number
    }
}

interface AnaliseFinanceira {
    parametros: {
        valor_imovel: number
        custo_fixo_anual: number
        custo_fixo_mensal: number
        custo_variavel_por_quarto_noite: number
        quartos: number
    }
    valor_liquido_mensal: Array<{
        mes: string
        receita_liquida: number
        custo_total: number
        valor_liquido: number
    }>
    resumo_anual: {
        faturamento_bruto_anual: number
        receita_liquida_anual: number
        custo_total_anual: number
        valor_liquido_anual: number
        rentabilidade_operacional_perc: string
        valorizacao_anual_perc: string
        rentabilidade_total_anual_perc: string
    }
}

// ============================================
// Constantes
// ============================================

const STATE_LABEL: Record<string, string> = {
    fila: "Fila",
    processamento_ia: "Processamento IA",
    revisao: "Revisão",
    aprovacao: "Aprovação",
    concluido: "Concluído",
    arquivada: "Arquivada",
}

const STATE_DOT: Record<string, string> = {
    fila: "bg-[#8e8e93]",
    processamento_ia: "bg-[#007aff]",
    revisao: "bg-[#5ac8fa]",
    aprovacao: "bg-[#ff9500]",
    concluido: "bg-[#34c759]",
    arquivada: "bg-[#c7c7cc]",
}

const TABS = [
    { key: "dados", label: "Dados", Icon: User },
    { key: "analise", label: "Análise", Icon: Sparkles },
    { key: "pricing", label: "Pricing", Icon: DollarSign },
    { key: "estudo", label: "Estudo", Icon: FileText },
    { key: "pitchdeck", label: "Pitchdeck", Icon: Send },
    { key: "sugestoes", label: "Sugestões", Icon: Sparkles },
    { key: "historico", label: "Histórico", Icon: Activity },
] as const

type TabKey = (typeof TABS)[number]["key"]

// ============================================
// Helpers
// ============================================

function formatDateTime(iso: string | null): string {
    if (!iso) return "—"
    return new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    })
}

function formatBRL(v: number | null | undefined, dec = 0): string {
    if (v == null) return "—"
    return Number(v).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: dec,
    })
}

// ============================================
// Componente principal
// ============================================

export default function OnboardingDetailPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string

    const [data, setData] = React.useState<OnboardingDetail | null>(null)
    const [events, setEvents] = React.useState<OnboardingEvent[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [reprocessing, setReprocessing] = React.useState(false)
    const [activating, setActivating] = React.useState(false)
    const [activeTab, setActiveTab] = React.useState<TabKey>("dados")

    const load = React.useCallback(() => {
        fetch(`/api/onboarding/${id}`)
            .then((r) => r.json())
            .then((j) => {
                if (!j.success) {
                    setError(j.error || "Falha ao carregar")
                    return
                }
                setData(j.data)
                setEvents(j.events || [])
            })
            .catch((e) => setError(String(e)))
            .finally(() => setLoading(false))
    }, [id])

    React.useEffect(() => {
        load()
    }, [load])

    async function patchAndReload(fields: Record<string, unknown>): Promise<{
        ok: boolean
        message?: string
        changes?: string[]
        cascade?: { target_recomputed: boolean; financial_recomputed: boolean; praca_stats_reloaded: boolean }
    }> {
        const res = await fetch(`/api/onboarding/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fields),
        })
        const json = await res.json()
        if (!res.ok) {
            return { ok: false, message: json.error || `HTTP ${res.status}` }
        }
        // Recarrega para pegar derivados recalculados
        await new Promise((r) => setTimeout(r, 100))
        load()
        return { ok: true, changes: json.changes, cascade: json.cascade }
    }

    async function handleReprocess() {
        setReprocessing(true)
        try {
            await fetch(`/api/onboarding/${id}/reprocess`, { method: "POST" })
            setTimeout(load, 3000)
        } finally {
            setReprocessing(false)
        }
    }

    async function handleArchive() {
        if (!confirm("Arquivar este onboarding?")) return
        await fetch(`/api/onboarding/${id}`, { method: "DELETE" })
        router.push("/propriedades/onboarding")
    }

    async function handleConclude() {
        if (
            !confirm(
                "Concluir este onboarding?\n\n• Envia e-mail ao proprietário\n• Posta no Slack #onboarding-precificação\n• Atualiza Jestor com link do Estudo\n• Cria basket de concorrentes\n• Unidade passa a aparecer em Dashboard, Pricing e Vendas\n\nNão tem desfazer."
            )
        ) {
            return
        }
        setActivating(true)
        try {
            const res = await fetch(`/api/onboarding/${id}/conclude`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ createBasket: true }),
            })
            const j = await res.json()
            if (!res.ok) {
                alert(`Falha ao concluir: ${j.error || "erro desconhecido"}`)
                return
            }
            load()
        } finally {
            setActivating(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="h-5 w-5 animate-spin text-[#8e8e93]" />
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-[#86868b]">
                <AlertCircle className="h-7 w-7 text-[#ff3b30]" />
                <p className="text-sm">{error || "Não encontrado"}</p>
                <Link
                    href="/propriedades/onboarding"
                    className="text-[13px] text-[#007aff] hover:underline"
                >
                    Voltar
                </Link>
            </div>
        )
    }

    const titulo = data.jestor_payload.rotulo || data.jestor_payload.propriedade || data.idpropriedade
    const canConclude = data.state === "aprovacao"

    return (
        <div className="-m-6 min-h-[calc(100vh-7rem)] bg-[#fafafa] dark:bg-zinc-950">
            {/* Toolbar sticky com vibrancy */}
            <div className="sticky top-0 z-20 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:bg-zinc-950/80 dark:border-white/[0.06]">
                <div className="max-w-6xl mx-auto px-8 py-4">
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-3 min-w-0">
                            <Link
                                href="/propriedades/onboarding"
                                className="flex items-center gap-1 text-[13px] text-[#007aff] hover:opacity-70 transition-opacity shrink-0"
                            >
                                <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
                                Onboarding
                            </Link>
                            <span className="text-[#c7c7cc]">·</span>
                            <div className="min-w-0 flex items-center gap-2.5">
                                <div className="min-w-0">
                                    <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-[#1d1d1f] truncate dark:text-zinc-100">
                                        {titulo}
                                    </h1>
                                </div>
                                <span
                                    className={`inline-flex items-center gap-1.5 rounded-full bg-[#f2f2f7] px-2.5 py-1 text-[11px] font-medium text-[#3a3a3c] dark:bg-zinc-800 dark:text-zinc-200`}
                                >
                                    <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[data.state]}`} />
                                    {STATE_LABEL[data.state] || data.state}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <AppleButton variant="secondary" onClick={handleReprocess} disabled={reprocessing}>
                                {reprocessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                Reprocessar
                            </AppleButton>
                            <AppleButton variant="secondary" onClick={handleArchive}>
                                <Archive className="h-3.5 w-3.5" />
                                Arquivar
                            </AppleButton>
                            {canConclude && (
                                <AppleButton variant="primary" onClick={handleConclude} disabled={activating}>
                                    {activating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                    Concluir
                                </AppleButton>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="max-w-6xl mx-auto px-8 flex gap-1">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`relative px-3 py-2.5 text-[13px] font-medium transition-colors ${
                                activeTab === t.key
                                    ? "text-[#1d1d1f] dark:text-zinc-100"
                                    : "text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-zinc-100"
                            }`}
                        >
                            <span className="flex items-center gap-1.5">
                                <t.Icon className="h-3.5 w-3.5" strokeWidth={2} />
                                {t.label}
                            </span>
                            {activeTab === t.key && (
                                <span className="absolute bottom-0 inset-x-3 h-[2px] rounded-full bg-[#007aff]" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-8 py-8 space-y-6">
                {/* KPI bar — sempre visível */}
                <KpiBar data={data} onPatch={patchAndReload} />

                {activeTab === "dados" && <DadosTab data={data} onPatch={patchAndReload} />}
                {activeTab === "analise" && <AnaliseTab data={data} onPatch={patchAndReload} />}
                {activeTab === "pricing" && <PricingTab onboardingId={id} />}
                {activeTab === "estudo" && <PdfPreview src={`/api/onboarding/${id}/pricing-pdf`} title="Estudo de Rentabilidade" driveUrl={data.pdf_url} />}
                {activeTab === "pitchdeck" && <PdfPreview src={`/api/onboarding/${id}/pitchdeck-pdf`} title="Pitchdeck Qavi.imob" driveUrl={data.pitchdeck_pdf_url} />}
                {activeTab === "sugestoes" && <SugestoesTab data={data} onReload={load} />}
                {activeTab === "historico" && <HistoricoTab events={events} />}

                {/* Timeline footer */}
                <Card>
                    <div className="px-5 py-3 flex flex-wrap gap-x-8 gap-y-1.5 text-[11px] text-[#86868b] tabular-nums">
                        <span><b className="text-[#3a3a3c] dark:text-zinc-300">Recebido</b> · {formatDateTime(data.created_at)}</span>
                        <span><b className="text-[#3a3a3c] dark:text-zinc-300">Enriquecido</b> · {formatDateTime(data.enriched_at)}</span>
                        <span><b className="text-[#3a3a3c] dark:text-zinc-300">Ativado</b> · {formatDateTime(data.activated_at)}</span>
                        {data.operator_email && <span><b className="text-[#3a3a3c] dark:text-zinc-300">Operador</b> · {data.operator_email}</span>}
                    </div>
                </Card>
            </div>
        </div>
    )
}

// ============================================
// KPI bar com edição inline
// ============================================

function KpiBar({
    data,
    onPatch,
}: {
    data: OnboardingDetail
    onPatch: (fields: Record<string, unknown>) => Promise<{ ok: boolean; message?: string }>
}) {
    const roi = data.analise_financeira?.resumo_anual.rentabilidade_total_anual_perc || null
    const liquido = data.analise_financeira?.resumo_anual.valor_liquido_anual ?? null
    const appreciation =
        data.property_appreciation != null ? `${(Number(data.property_appreciation) * 100).toFixed(1)}%` : null

    return (
        <div className="grid grid-cols-4 gap-3">
            <KpiCard
                label="Valor do Imóvel"
                value={formatBRL(data.property_value, 0)}
                editable
                onSave={async (v) => onPatch({ property_value: Number(v.replace(/\D/g, "")) })}
                parseDisplay={(s) => s.replace(/[^\d,.]/g, "")}
                hint="Recalcula meta, custos e ROI"
            />
            <KpiCard
                label="Meta Anual"
                value={formatBRL(data.meta_anual, 0)}
                accent="#007aff"
                editable
                onSave={async (v) => onPatch({ meta_anual: Number(v.replace(/\D/g, "")) })}
                parseDisplay={(s) => s.replace(/[^\d,.]/g, "")}
                hint="Sobrescreve fórmula 14% — recalcula distribuição"
            />
            <KpiCard
                label="Valorização Anual"
                value={appreciation || "—"}
                editable
                onSave={async (v) => {
                    const cleaned = v.replace(/[^\d,.-]/g, "").replace(",", ".")
                    const pct = parseFloat(cleaned)
                    if (Number.isNaN(pct)) return { ok: false, message: "Valor inválido" }
                    // Aceita 8 (assume %) ou 0.08 (já decimal)
                    const decimal = pct > 1 ? pct / 100 : pct
                    return onPatch({ property_appreciation: decimal })
                }}
                parseDisplay={(s) => s.replace("%", "")}
                hint="Aceita 8 (8%) ou 0.08 — recalcula ROI total"
            />
            <KpiCard
                label="ROI Anual"
                value={roi || "—"}
                accent="#34c759"
                derived
            />
            <KpiCard
                label="Resultado Líquido"
                value={formatBRL(liquido, 0)}
                accent="#34c759"
                derived
                fullWidthOnMobile
            />
            <KpiCard
                label="Receita Líquida"
                value={formatBRL(data.analise_financeira?.resumo_anual.receita_liquida_anual, 0)}
                derived
            />
            <KpiCard
                label="Custo Total Anual"
                value={formatBRL(data.analise_financeira?.resumo_anual.custo_total_anual, 0)}
                derived
            />
            <KpiCard
                label="Quartos"
                value={String(data.analise_financeira?.parametros.quartos || data.jestor_payload.quartos || "—")}
                editable
                onSave={async (v) => onPatch({ quartos: Number(v) })}
                hint="Recalcula custo variável mensal"
            />
        </div>
    )
}

function KpiCard({
    label,
    value,
    accent,
    derived,
    editable,
    onSave,
    parseDisplay,
    hint,
    fullWidthOnMobile,
}: {
    label: string
    value: string
    accent?: string
    derived?: boolean
    editable?: boolean
    onSave?: (v: string) => Promise<{ ok: boolean; message?: string }>
    parseDisplay?: (s: string) => string
    hint?: string
    fullWidthOnMobile?: boolean
}) {
    const [editing, setEditing] = React.useState(false)
    const [draft, setDraft] = React.useState(value)
    const [saving, setSaving] = React.useState(false)
    const [err, setErr] = React.useState<string | null>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
        if (editing) {
            setDraft(parseDisplay ? parseDisplay(value) : value)
            setTimeout(() => inputRef.current?.select(), 0)
        }
    }, [editing, value, parseDisplay])

    async function commit() {
        if (!onSave) return
        setSaving(true)
        setErr(null)
        const res = await onSave(draft)
        setSaving(false)
        if (!res.ok) {
            setErr(res.message || "Falha")
            return
        }
        setEditing(false)
    }

    return (
        <div
            className={`group relative rounded-xl border border-black/[0.06] bg-white px-4 py-3 transition-all duration-200 dark:border-white/[0.08] dark:bg-zinc-900 ${
                fullWidthOnMobile ? "" : ""
            } ${derived ? "" : "hover:border-black/[0.12]"}`}
        >
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10.5px] uppercase tracking-[0.06em] font-medium text-[#86868b]">
                    {label}
                </span>
                {derived && (
                    <span className="text-[9px] uppercase tracking-wide text-[#c7c7cc]" title="Calculado automaticamente">
                        auto
                    </span>
                )}
                {editable && !editing && (
                    <button
                        onClick={() => setEditing(true)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#86868b] hover:text-[#007aff]"
                        title={hint || "Editar"}
                    >
                        <Pencil className="h-3 w-3" />
                    </button>
                )}
            </div>

            {editing ? (
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                        <input
                            ref={inputRef}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") commit()
                                if (e.key === "Escape") {
                                    setEditing(false)
                                    setErr(null)
                                }
                            }}
                            disabled={saving}
                            className="flex-1 min-w-0 text-[17px] font-semibold tabular-nums tracking-[-0.01em] bg-transparent outline-none border-b-2 border-[#007aff] focus:border-[#007aff] text-[#1d1d1f] dark:text-zinc-100"
                            style={{ color: accent || undefined }}
                        />
                        <button
                            onClick={commit}
                            disabled={saving}
                            className="text-[#34c759] hover:opacity-70 disabled:opacity-40"
                        >
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                        </button>
                    </div>
                    {err && <p className="text-[10px] text-[#ff3b30]">{err}</p>}
                    {hint && !err && <p className="text-[10px] text-[#86868b]">{hint}</p>}
                </div>
            ) : (
                <div
                    className="text-[17px] font-semibold tabular-nums tracking-[-0.01em] text-[#1d1d1f] dark:text-zinc-100"
                    style={{ color: accent || undefined }}
                >
                    {value}
                </div>
            )}
        </div>
    )
}

// ============================================
// Tab: Dados (edição de payload + contato)
// ============================================

function DadosTab({
    data,
    onPatch,
}: {
    data: OnboardingDetail
    onPatch: (fields: Record<string, unknown>) => Promise<{ ok: boolean; message?: string }>
}) {
    return (
        <div className="space-y-6">
            <SectionCard title="Identificação" subtitle="Dados editáveis vindos do payload Jestor">
                <FieldGrid>
                    <EditableRow
                        label="Rótulo"
                        value={data.jestor_payload.rotulo || ""}
                        onSave={async (v) => onPatch({ rotulo: v })}
                    />
                    <EditableRow
                        label="Proprietário"
                        value={data.jestor_payload.proprietario || ""}
                        onSave={async (v) => onPatch({ proprietario: v })}
                    />
                    <EditableRow
                        label="Localidade (praça)"
                        value={data.jestor_payload.localidade || ""}
                        onSave={async (v) => onPatch({ localidade: v })}
                        hint="Recarrega estatísticas da praça e recalcula meta"
                    />
                    <EditableRow
                        label="Quartos"
                        value={String(data.jestor_payload.quartos ?? "")}
                        onSave={async (v) => onPatch({ quartos: Number(v) })}
                        hint="Recalcula custo variável mensal"
                    />
                    <ReadOnlyRow label="ID Propriedade" value={data.idpropriedade} mono />
                    <ReadOnlyRow label="Jestor Record" value={data.jestor_record_id || "—"} mono />
                </FieldGrid>
            </SectionCard>

            <SectionCard title="Contato do Proprietário" subtitle="Pode editar caso a hidratação BQ esteja incompleta">
                <FieldGrid>
                    <EditableRow
                        label="Nome"
                        icon={<User className="h-3 w-3" />}
                        value={data.owner_name || ""}
                        onSave={async (v) => onPatch({ owner_name: v })}
                    />
                    <EditableRow
                        label="E-mail"
                        icon={<Mail className="h-3 w-3" />}
                        value={data.owner_email || ""}
                        onSave={async (v) => onPatch({ owner_email: v })}
                        type="email"
                    />
                    <EditableRow
                        label="Telefone"
                        icon={<Phone className="h-3 w-3" />}
                        value={data.owner_phone || ""}
                        onSave={async (v) => onPatch({ owner_phone: v })}
                    />
                </FieldGrid>
                {data.owner_email_sent_at && (
                    <p className="mt-3 text-[11px] text-[#86868b] flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-[#34c759]" /> E-mail enviado em {formatDateTime(data.owner_email_sent_at)}
                    </p>
                )}
            </SectionCard>

            <SectionCard title="Hidratação BQ (auditoria)" subtitle="Snapshot do warehouse.propriedades_subgrupos no momento do recebimento">
                {data.bq_snapshot ? (
                    <pre className="text-[11px] bg-[#f5f5f7] p-3 rounded-lg overflow-x-auto leading-relaxed dark:bg-zinc-800">
                        {JSON.stringify(data.bq_snapshot, null, 2)}
                    </pre>
                ) : (
                    <p className="text-[12px] text-[#86868b]">Não hidratada (rodando ou propriedade ausente do BQ).</p>
                )}
            </SectionCard>

            <SectionCard title="Anotações" subtitle="Notas internas do operador (sem cascata)">
                <textarea
                    defaultValue={data.notes || ""}
                    onBlur={(e) => {
                        if (e.target.value !== (data.notes || "")) onPatch({ notes: e.target.value })
                    }}
                    rows={3}
                    placeholder="Notas para o time..."
                    className="w-full text-[13px] bg-[#f5f5f7] border-0 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#007aff] focus:ring-offset-0 placeholder:text-[#c7c7cc] dark:bg-zinc-800 dark:text-zinc-100"
                />
            </SectionCard>
        </div>
    )
}

// ============================================
// Tab: Análise
// ============================================

function AnaliseTab({
    data,
}: {
    data: OnboardingDetail
    onPatch: (fields: Record<string, unknown>) => Promise<{ ok: boolean; message?: string }>
}) {
    const meses = data.meta_distribuicao_mensal?.items || []
    const fin = data.analise_financeira

    return (
        <div className="space-y-6">
            <SectionCard
                title="Distribuição mensal da meta"
                subtitle="Recalculada quando você edita Valor do Imóvel, Meta Anual ou Quartos no painel acima"
            >
                {meses.length === 0 ? (
                    <p className="text-[12px] text-[#86868b]">Pipeline ainda não calculou.</p>
                ) : (
                    <div className="overflow-hidden rounded-lg border border-black/[0.06] dark:border-white/[0.08]">
                        <table className="w-full text-[12px]">
                            <thead className="bg-[#f5f5f7] text-[#86868b] dark:bg-zinc-800">
                                <tr>
                                    <th className="text-left font-medium px-3 py-2">Mês</th>
                                    <th className="text-right font-medium px-3 py-2">Meta</th>
                                    <th className="text-right font-medium px-3 py-2">Noites</th>
                                    <th className="text-right font-medium px-3 py-2">Diária</th>
                                    <th className="text-right font-medium px-3 py-2">Lucro</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
                                {meses.map((m, i) => {
                                    const linha = fin?.valor_liquido_mensal[i]
                                    const eventos = m.feriados ?? (m.feriado ? [m.feriado] : [])
                                    // Diária = dias normais (sem feriado). Se a meta não computou nao_feriado, fallback.
                                    const diariaNormal =
                                        m.nao_feriado?.diaria_media_nao_feriado ?? m.meta_diaria_media
                                    const noitesNormal = m.nao_feriado?.noites_nao_feriado ?? m.meta_noites_2026
                                    return (
                                        <tr key={m.mes} className="hover:bg-[#fafafa] dark:hover:bg-zinc-800/50">
                                            <td className="px-3 py-2 font-medium text-[#1d1d1f] dark:text-zinc-100">
                                                {m.mes}
                                                {eventos.length > 0 && (
                                                    <div className="text-[10px] text-[#86868b] font-normal mt-0.5">
                                                        {eventos.map((e) => (
                                                            <div key={e.nome}>
                                                                · {e.nome} ({(e as { noites_feriado?: number }).noites_feriado ?? "?"}n a {formatBRL((e as { diaria_media_feriado?: number }).diaria_media_feriado ?? 0, 0)})
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums">{formatBRL(m.meta_faturamento, 0)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums text-[#86868b]">{noitesNormal}</td>
                                            <td className="px-3 py-2 text-right tabular-nums text-[#86868b]">{formatBRL(diariaNormal, 0)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: (linha?.valor_liquido ?? 0) >= 0 ? "#34c759" : "#ff3b30" }}>
                                                {formatBRL(linha?.valor_liquido, 0)}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                            {fin && (
                                <tfoot className="bg-[#f5f5f7] font-semibold text-[#1d1d1f] dark:bg-zinc-800 dark:text-zinc-100">
                                    <tr>
                                        <td className="px-3 py-2">Total Anual</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{formatBRL(fin.resumo_anual.faturamento_bruto_anual, 0)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{meses.reduce((s, m) => s + m.meta_noites_2026, 0)}</td>
                                        <td className="px-3 py-2"></td>
                                        <td className="px-3 py-2 text-right tabular-nums text-[#34c759]">{formatBRL(fin.resumo_anual.valor_liquido_anual, 0)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                )}
            </SectionCard>

            <SectionCard
                title={`Imóveis similares (${data.similar_properties?.items?.length || 0})`}
                subtitle="Saída do RPC buscar_imoveis_semelhantes — base do Gemini"
            >
                {data.similar_properties?.items && data.similar_properties.items.length > 0 ? (
                    <pre className="text-[11px] bg-[#f5f5f7] p-3 rounded-lg overflow-x-auto max-h-72 leading-relaxed dark:bg-zinc-800">
                        {JSON.stringify(data.similar_properties.items.slice(0, 5), null, 2)}
                    </pre>
                ) : (
                    <p className="text-[12px] text-[#86868b]">Nenhum vizinho encontrado.</p>
                )}
            </SectionCard>
        </div>
    )
}

// ============================================
// Tab: Sugestões
// ============================================

function SugestoesTab({
    data,
    onReload,
}: {
    data: OnboardingDetail
    onReload: () => void
}) {
    const items = data.suggested_basket?.items || []
    const [baskets, setBaskets] = React.useState<{ id: string; name: string }[]>([])
    const [selected, setSelected] = React.useState<Set<number>>(
        new Set(items.map((it) => it.id_numerica))
    )
    const [mode, setMode] = React.useState<"add_to_existing" | "create_new">("create_new")
    const [chosenBasketId, setChosenBasketId] = React.useState<string>("")
    const [newName, setNewName] = React.useState<string>(`Onboarding · ${data.idpropriedade}`)
    const [busy, setBusy] = React.useState(false)
    const [feedback, setFeedback] = React.useState<{ kind: "ok" | "err"; msg: string } | null>(null)

    React.useEffect(() => {
        fetch("/api/onboarding/baskets")
            .then((r) => r.json())
            .then((j) => {
                if (j.success) setBaskets(j.data || [])
            })
            .catch(() => undefined)
    }, [])

    const toggle = (id: number) => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    async function handleApply() {
        if (selected.size === 0) {
            setFeedback({ kind: "err", msg: "Selecione ao menos um concorrente" })
            return
        }
        if (mode === "add_to_existing" && !chosenBasketId) {
            setFeedback({ kind: "err", msg: "Escolha uma basket existente" })
            return
        }
        setBusy(true)
        setFeedback(null)
        const body =
            mode === "create_new"
                ? { action: "create_new" as const, name: newName, selectedItemIds: Array.from(selected) }
                : { action: "add_to_existing" as const, basketId: chosenBasketId, selectedItemIds: Array.from(selected) }

        const res = await fetch(`/api/onboarding/${data.id}/apply-basket`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })
        const j = await res.json()
        setBusy(false)
        if (!res.ok) {
            setFeedback({ kind: "err", msg: j.error || "Falha" })
            return
        }
        setFeedback({
            kind: "ok",
            msg:
                mode === "create_new"
                    ? `Basket criada com ${j.items_inserted} concorrente(s)`
                    : `${j.items_inserted} adicionado(s)${j.items_skipped_duplicate ? `, ${j.items_skipped_duplicate} já existiam` : ""}`,
        })
        onReload()
    }

    return (
        <div className="space-y-6">
            {data.matched_airbnb_listing && (
                <Card>
                    <div className="px-5 py-3 flex items-center gap-3 bg-[#e8f5ff] dark:bg-blue-950/20">
                        <Info className="h-4 w-4 text-[#007aff] shrink-0" strokeWidth={2} />
                        <p className="text-[12.5px] text-[#3a3a3c] dark:text-zinc-300">
                            Encontramos um anúncio Airbnb pré-existente desta unidade (≤200m, capacidade compatível):
                            {" "}
                            <a href={data.matched_airbnb_listing} target="_blank" rel="noopener" className="text-[#007aff] hover:underline break-all">
                                ver anúncio →
                            </a>
                        </p>
                    </div>
                </Card>
            )}

            <SectionCard
                title="Cesta de concorrentes sugerida"
                subtitle={`${items.length} unidades · raio ${data.suggested_basket?.raio_km ?? "—"}km · capacidade ${data.suggested_basket?.hospedes_alvo ?? "—"} hósp.`}
            >
                {items.length === 0 ? (
                    <p className="text-[12px] text-[#86868b]">
                        Nenhuma sugestão encontrada (sem coordenadas ou sem vizinhos no raio).
                    </p>
                ) : (
                    <>
                        {/* Lista com checkbox */}
                        <div className="rounded-lg border border-black/[0.06] divide-y divide-black/[0.04] dark:border-white/[0.08] dark:divide-white/[0.05] mb-5">
                            <div className="px-3 py-2 flex items-center gap-3 text-[10.5px] uppercase tracking-[0.06em] font-medium text-[#86868b] bg-[#fafafa] dark:bg-zinc-800/50">
                                <button
                                    onClick={() =>
                                        setSelected(selected.size === items.length ? new Set() : new Set(items.map((it) => it.id_numerica)))
                                    }
                                    className="text-[#007aff] normal-case text-[11px] font-medium tracking-normal hover:opacity-70"
                                >
                                    {selected.size === items.length ? "Desmarcar todos" : "Marcar todos"}
                                </button>
                                <span className="ml-auto tabular-nums">
                                    {selected.size}/{items.length} selecionado(s)
                                </span>
                            </div>
                            {items.map((item, i) => {
                                const isOn = selected.has(item.id_numerica)
                                return (
                                    <label
                                        key={i}
                                        className="px-3 py-2 flex items-center gap-3 text-[12.5px] hover:bg-[#fafafa] dark:hover:bg-zinc-800/40 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isOn}
                                            onChange={() => toggle(item.id_numerica)}
                                            className="h-3.5 w-3.5 accent-[#007aff]"
                                        />
                                        <span className="w-5 text-[10px] text-[#86868b] tabular-nums">{i + 1}</span>
                                        <span className="flex-1 truncate text-[#1d1d1f] dark:text-zinc-100">{item.nome_anuncio || "—"}</span>
                                        <span className="w-14 text-right tabular-nums text-[#86868b]">{item.distancia_km?.toFixed(2)}km</span>
                                        <span className="w-20 text-right tabular-nums font-medium">
                                            {item.preco_por_noite ? formatBRL(item.preco_por_noite, 0) : "—"}
                                        </span>
                                        {item.url_anuncio && (
                                            <a
                                                href={item.url_anuncio}
                                                target="_blank"
                                                rel="noopener"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-[#007aff] hover:opacity-70"
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        )}
                                    </label>
                                )
                            })}
                        </div>

                        {/* Toggle de ação */}
                        <div className="flex items-center gap-2 mb-3 p-1 bg-[#f2f2f7] rounded-lg w-fit dark:bg-zinc-800">
                            <button
                                onClick={() => setMode("create_new")}
                                className={`text-[12px] font-medium px-3 py-1.5 rounded-md transition-all ${
                                    mode === "create_new"
                                        ? "bg-white text-[#1d1d1f] shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                                        : "text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-zinc-200"
                                }`}
                            >
                                Criar nova cesta
                            </button>
                            <button
                                onClick={() => setMode("add_to_existing")}
                                className={`text-[12px] font-medium px-3 py-1.5 rounded-md transition-all ${
                                    mode === "add_to_existing"
                                        ? "bg-white text-[#1d1d1f] shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                                        : "text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-zinc-200"
                                }`}
                            >
                                Adicionar à cesta existente
                            </button>
                        </div>

                        {/* Form da ação selecionada */}
                        {mode === "create_new" ? (
                            <div className="space-y-2">
                                <label className="text-[10.5px] uppercase tracking-[0.06em] font-medium text-[#86868b]">
                                    Nome da nova cesta
                                </label>
                                <input
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full text-[13px] bg-[#f5f5f7] border-0 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#007aff] dark:bg-zinc-800 dark:text-zinc-100"
                                />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-[10.5px] uppercase tracking-[0.06em] font-medium text-[#86868b]">
                                    Cesta existente
                                </label>
                                <select
                                    value={chosenBasketId}
                                    onChange={(e) => setChosenBasketId(e.target.value)}
                                    className="w-full text-[13px] bg-[#f5f5f7] border-0 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#007aff] dark:bg-zinc-800 dark:text-zinc-100"
                                >
                                    <option value="">— escolha uma —</option>
                                    {baskets.map((b) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                                {baskets.length === 0 && (
                                    <p className="text-[10.5px] text-[#86868b]">Nenhuma cesta existente cadastrada.</p>
                                )}
                            </div>
                        )}

                        <div className="mt-4 flex items-center justify-between">
                            {feedback && (
                                <p className={`text-[11.5px] ${feedback.kind === "ok" ? "text-[#34c759]" : "text-[#ff3b30]"}`}>
                                    {feedback.msg}
                                </p>
                            )}
                            <button
                                onClick={handleApply}
                                disabled={busy || selected.size === 0}
                                className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#007aff] text-white h-8 px-4 text-[12.5px] font-medium hover:bg-[#0066d6] disabled:opacity-50 transition-colors"
                            >
                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                {mode === "create_new" ? "Criar cesta" : "Adicionar à cesta"}
                            </button>
                        </div>
                    </>
                )}
            </SectionCard>

            <SectionCard title="Baserate sugerido" subtitle="Mediana do sub_grupo nos últimos 30 dias">
                <div className="text-[24px] font-semibold tabular-nums tracking-[-0.02em] text-[#1d1d1f] dark:text-zinc-100">
                    {formatBRL(data.suggested_baserate, 0)}
                </div>
            </SectionCard>

            <SectionCard title="Sazonalidade padrão" subtitle="Padrão vinculado à praça">
                {data.suggested_sazonalidades ? (
                    <div className="text-[13px]">
                        <p className="font-medium text-[#1d1d1f] dark:text-zinc-100">{data.suggested_sazonalidades.seasonality_name}</p>
                        <p className="text-[11px] text-[#86868b] mt-0.5">
                            {data.suggested_sazonalidades.praca} · {data.suggested_sazonalidades.periods?.length || 0} períodos
                        </p>
                    </div>
                ) : (
                    <p className="text-[12px] text-[#86868b]">Nenhuma sazonalidade vinculada à praça.</p>
                )}
            </SectionCard>
        </div>
    )
}

// ============================================
// Tab: Histórico
// ============================================

function HistoricoTab({ events }: { events: OnboardingEvent[] }) {
    return (
        <Card>
            {events.length === 0 ? (
                <div className="p-8 text-center text-[12px] text-[#86868b]">Nenhum evento registrado.</div>
            ) : (
                <ul className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
                    {events.map((ev) => (
                        <li key={ev.id} className="px-5 py-3 flex items-start gap-4 text-[12px]">
                            <span className="inline-flex items-center rounded-full bg-[#f2f2f7] px-2 py-0.5 text-[10.5px] font-mono text-[#3a3a3c] shrink-0 dark:bg-zinc-800 dark:text-zinc-300">
                                {ev.event_type}
                            </span>
                            <div className="flex-1 min-w-0">
                                {ev.payload && Object.keys(ev.payload).length > 0 && (
                                    <pre className="text-[11px] text-[#86868b] overflow-x-auto leading-relaxed">
                                        {JSON.stringify(ev.payload, null, 0)}
                                    </pre>
                                )}
                            </div>
                            <span className="text-[10.5px] text-[#86868b] tabular-nums shrink-0">
                                {formatDateTime(ev.created_at)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    )
}

// ============================================
// Componentes primitivos (Apple)
// ============================================

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div
            className={`rounded-2xl border border-black/[0.06] bg-white overflow-hidden dark:border-white/[0.08] dark:bg-zinc-900 ${className}`}
        >
            {children}
        </div>
    )
}

function SectionCard({
    title,
    subtitle,
    children,
}: {
    title: string
    subtitle?: string
    children: React.ReactNode
}) {
    return (
        <Card>
            <div className="px-5 pt-4 pb-3">
                <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[#1d1d1f] dark:text-zinc-100">
                    {title}
                </h3>
                {subtitle && (
                    <p className="text-[11.5px] text-[#86868b] mt-0.5 leading-snug">{subtitle}</p>
                )}
            </div>
            <div className="px-5 pb-5">{children}</div>
        </Card>
    )
}

function FieldGrid({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">{children}</div>
}

function ReadOnlyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div>
            <div className="text-[10.5px] uppercase tracking-[0.06em] font-medium text-[#86868b] mb-1">{label}</div>
            <div className={`text-[13px] text-[#1d1d1f] dark:text-zinc-100 ${mono ? "font-mono" : ""}`}>{value}</div>
        </div>
    )
}

function EditableRow({
    label,
    icon,
    value,
    onSave,
    type = "text",
    hint,
}: {
    label: string
    icon?: React.ReactNode
    value: string
    onSave: (v: string) => Promise<{ ok: boolean; message?: string }>
    type?: string
    hint?: string
}) {
    const [draft, setDraft] = React.useState(value)
    const [saving, setSaving] = React.useState(false)
    const [saved, setSaved] = React.useState(false)
    const [err, setErr] = React.useState<string | null>(null)
    React.useEffect(() => setDraft(value), [value])

    async function commit() {
        if (draft === value) return
        setSaving(true)
        setErr(null)
        const res = await onSave(draft)
        setSaving(false)
        if (!res.ok) {
            setErr(res.message || "Falha")
            return
        }
        setSaved(true)
        setTimeout(() => setSaved(false), 1200)
    }

    return (
        <div>
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.06em] font-medium text-[#86868b] mb-1">
                {icon}
                {label}
            </div>
            <div className="relative">
                <input
                    type={type}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                        if (e.key === "Escape") {
                            setDraft(value)
                            ;(e.target as HTMLInputElement).blur()
                        }
                    }}
                    disabled={saving}
                    placeholder="—"
                    className="w-full text-[13px] bg-transparent border-0 border-b border-[#d1d1d6] rounded-none px-0 py-1.5 outline-none focus:border-[#007aff] transition-colors text-[#1d1d1f] dark:text-zinc-100 dark:border-zinc-700 dark:focus:border-[#007aff]"
                />
                {saving && (
                    <Loader2 className="absolute right-0 top-1.5 h-3.5 w-3.5 animate-spin text-[#8e8e93]" />
                )}
                {saved && (
                    <Check className="absolute right-0 top-1.5 h-3.5 w-3.5 text-[#34c759] animate-in fade-in" strokeWidth={2.5} />
                )}
            </div>
            {err && <p className="text-[10.5px] text-[#ff3b30] mt-1">{err}</p>}
            {hint && !err && <p className="text-[10.5px] text-[#86868b] mt-1">{hint}</p>}
        </div>
    )
}

function AppleButton({
    variant,
    children,
    onClick,
    disabled,
}: {
    variant: "primary" | "secondary"
    children: React.ReactNode
    onClick: () => void
    disabled?: boolean
}) {
    const base =
        "inline-flex items-center gap-1.5 rounded-full text-[12.5px] font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed h-8 px-3.5"
    const styles =
        variant === "primary"
            ? "bg-[#007aff] text-white hover:bg-[#0066d6] active:bg-[#005bb5]"
            : "bg-[#f2f2f7] text-[#1d1d1f] hover:bg-[#e8e8ed] active:bg-[#dcdce0] dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
    return (
        <button onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
            {children}
        </button>
    )
}

function PdfPreview({ src, title, driveUrl }: { src: string; title: string; driveUrl?: string | null }) {
    const [loaded, setLoaded] = React.useState(false)
    const [errored, setErrored] = React.useState(false)
    return (
        <div className="space-y-2">
            <Card>
                <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06] dark:border-white/[0.06]">
                    <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[#1d1d1f] dark:text-zinc-100">{title}</h3>
                    <a href={src} target="_blank" rel="noopener" className="text-[12px] text-[#007aff] hover:opacity-70">
                        Abrir em nova aba ↗
                    </a>
                </div>
                <div className="relative bg-[#fafafa] dark:bg-zinc-950" style={{ height: "75vh" }}>
                    {!loaded && !errored && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-[#8e8e93]" />
                        </div>
                    )}
                    {errored && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[12px] text-[#86868b]">
                            <AlertCircle className="h-5 w-5 text-[#ff3b30]" />
                            Falha ao gerar PDF (pipeline incompleto?).
                        </div>
                    )}
                    <iframe
                        src={src}
                        className="w-full h-full"
                        onLoad={() => setLoaded(true)}
                        onError={() => setErrored(true)}
                    />
                </div>
            </Card>
            {driveUrl && driveUrl.startsWith("http") && (
                <p className="text-[11px] text-[#86868b] px-1">
                    Versão Drive: <a href={driveUrl} target="_blank" rel="noopener" className="text-[#007aff] hover:underline break-all">{driveUrl}</a>
                </p>
            )}
        </div>
    )
}
