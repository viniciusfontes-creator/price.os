"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
    ArrowLeft,
    Loader2,
    AlertCircle,
    RefreshCw,
    Archive,
    User,
    Mail,
    Phone,
    MapPin,
    Hash,
    DollarSign,
    Activity,
    FileText,
    Send,
    Sparkles,
    ExternalLink,
    CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface OnboardingDetail {
    id: string
    idpropriedade: string
    jestor_record_id: string | null
    jestor_payload: Record<string, unknown>
    state: string
    bq_snapshot: Record<string, unknown> | null
    similar_properties: { items?: unknown[] } | null
    property_value: number | null
    property_appreciation: number | null
    meta_anual: number | null
    meta_distribuicao_mensal: { items?: unknown[] } | null
    analise_financeira: Record<string, unknown> | null
    pdf_url: string | null
    pdf_drive_file_id: string | null
    owner_name: string | null
    owner_email: string | null
    owner_phone: string | null
    owner_email_sent_at: string | null
    pitchdeck_pdf_url: string | null
    pitchdeck_drive_file_id: string | null
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

interface BasketItem {
    id_numerica: number
    nome_anuncio: string | null
    url_anuncio: string | null
    distancia_km: number | null
    preco_por_noite: number | null
    hospedes_adultos: number | null
}

interface OnboardingEvent {
    id: string
    event_type: string
    payload: Record<string, unknown> | null
    created_at: string
}

const STATE_LABEL: Record<string, string> = {
    recebida: "Recebida",
    em_analise: "Em Análise",
    estudo_pronto: "Estudo Pronto",
    apresentado: "Apresentado",
    aguardando_aprovacao: "Aguardando Aprovação",
    ativada: "Ativada",
    arquivada: "Arquivada",
}

const STATE_COLOR: Record<string, string> = {
    recebida: "bg-slate-100 text-slate-700",
    em_analise: "bg-blue-100 text-blue-700",
    estudo_pronto: "bg-cyan-100 text-cyan-700",
    apresentado: "bg-violet-100 text-violet-700",
    aguardando_aprovacao: "bg-amber-100 text-amber-700",
    ativada: "bg-emerald-100 text-emerald-700",
    arquivada: "bg-zinc-100 text-zinc-600",
}

function formatDateTime(iso: string | null): string {
    if (!iso) return "—"
    return new Date(iso).toLocaleString("pt-BR")
}

function formatBRL(v: number | null): string {
    if (v == null) return "—"
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

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

    const load = React.useCallback(() => {
        setLoading(true)
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

    async function handleReprocess() {
        setReprocessing(true)
        try {
            await fetch(`/api/onboarding/${id}/reprocess`, { method: "POST" })
            // Aguarda alguns segundos e recarrega para pegar mudança de state
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

    async function handleActivate() {
        if (
            !confirm(
                "Ativar esta unidade?\n\nIsso vai:\n- Criar a basket de concorrentes com as sugestões aprovadas\n- Marcar a unidade como visível em Dashboard / Pricing / Vendas\n\nNão tem desfazer (use Arquivar se errar)."
            )
        ) {
            return
        }
        setActivating(true)
        try {
            const res = await fetch(`/api/onboarding/${id}/activate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ createBasket: true }),
            })
            const j = await res.json()
            if (!res.ok) {
                alert(`Falha ao ativar: ${j.error || "erro desconhecido"}`)
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
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-muted-foreground">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p>{error || "Não encontrado"}</p>
                <Link href="/propriedades/onboarding">
                    <Button variant="outline" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                    </Button>
                </Link>
            </div>
        )
    }

    const payload = data.jestor_payload as {
        propriedade?: string
        rotulo?: string
        proprietario?: string
        localidade?: string
        quartos?: string | number
    }
    const titulo = payload.rotulo || payload.propriedade || data.idpropriedade

    return (
        <div className="max-w-6xl mx-auto py-2 space-y-4">
            {/* Top bar */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <Link href="/propriedades/onboarding">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold truncate">{titulo}</h1>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <Badge variant="outline" className="text-[10px] font-mono">
                                {data.idpropriedade}
                            </Badge>
                            {data.jestor_record_id && (
                                <span className="flex items-center gap-1">
                                    <Hash className="h-3 w-3" /> Jestor #{data.jestor_record_id}
                                </span>
                            )}
                            <Badge className={cn("text-[10px]", STATE_COLOR[data.state])}>
                                {STATE_LABEL[data.state] || data.state}
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReprocess}
                        disabled={reprocessing}
                    >
                        {reprocessing ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Reprocessar
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleArchive}>
                        <Archive className="h-4 w-4 mr-2" /> Arquivar
                    </Button>
                    {data.state !== "ativada" && data.state !== "arquivada" && (
                        <Button
                            size="sm"
                            onClick={handleActivate}
                            disabled={activating}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {activating ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                            )}
                            Ativar unidade
                        </Button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="dados" className="w-full">
                <TabsList>
                    <TabsTrigger value="dados">
                        <User className="h-3.5 w-3.5 mr-1.5" /> Dados
                    </TabsTrigger>
                    <TabsTrigger value="analise">
                        <DollarSign className="h-3.5 w-3.5 mr-1.5" /> Análise
                    </TabsTrigger>
                    <TabsTrigger value="estudo">
                        <FileText className="h-3.5 w-3.5 mr-1.5" /> Estudo
                    </TabsTrigger>
                    <TabsTrigger value="pitchdeck">
                        <Send className="h-3.5 w-3.5 mr-1.5" /> Pitchdeck
                    </TabsTrigger>
                    <TabsTrigger value="sugestoes">
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Sugestões
                    </TabsTrigger>
                    <TabsTrigger value="historico">
                        <Activity className="h-3.5 w-3.5 mr-1.5" /> Histórico
                    </TabsTrigger>
                </TabsList>

                {/* Dados */}
                <TabsContent value="dados" className="space-y-4">
                    <Card className="p-4">
                        <h3 className="text-sm font-medium mb-3">Payload da Jestor</h3>
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            <Field label="Propriedade" value={payload.propriedade} />
                            <Field label="Rótulo" value={payload.rotulo} />
                            <Field label="Proprietário" value={payload.proprietario} />
                            <Field label="Localidade" value={payload.localidade} />
                            <Field label="Quartos" value={String(payload.quartos ?? "")} />
                        </dl>
                    </Card>

                    <Card className="p-4">
                        <h3 className="text-sm font-medium mb-3">Hidratação BQ (W1)</h3>
                        {data.bq_snapshot ? (
                            <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto">
                                {JSON.stringify(data.bq_snapshot, null, 2)}
                            </pre>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Ainda não hidratado (pipeline rodando ou propriedade não encontrada no BQ).
                            </p>
                        )}
                    </Card>

                    <Card className="p-4">
                        <h3 className="text-sm font-medium mb-3">Contato do Proprietário (BQ)</h3>
                        <dl className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
                            <Field label="Nome" value={data.owner_name} icon={<User className="h-3 w-3" />} />
                            <Field label="E-mail" value={data.owner_email} icon={<Mail className="h-3 w-3" />} />
                            <Field label="Telefone" value={data.owner_phone} icon={<Phone className="h-3 w-3" />} />
                        </dl>
                        {data.owner_email_sent_at && (
                            <p className="text-xs text-muted-foreground mt-3">
                                E-mail enviado em {formatDateTime(data.owner_email_sent_at)}
                            </p>
                        )}
                    </Card>
                </TabsContent>

                {/* Análise */}
                <TabsContent value="analise" className="space-y-4">
                    <div className="grid grid-cols-4 gap-3">
                        <KpiCard
                            label="Valor do Imóvel"
                            value={formatBRL(data.property_value)}
                        />
                        <KpiCard label="Meta Anual" value={formatBRL(data.meta_anual)} />
                        <KpiCard
                            label="ROI Anual"
                            value={
                                (data.analise_financeira as { resumo_anual?: { rentabilidade_total_anual_perc?: string } } | null)
                                    ?.resumo_anual?.rentabilidade_total_anual_perc || "—"
                            }
                        />
                        <KpiCard
                            label="Valorização Anual"
                            value={
                                data.property_appreciation != null
                                    ? `${(Number(data.property_appreciation) * 100).toFixed(2)}%`
                                    : "—"
                            }
                        />
                    </div>

                    <Card className="p-4">
                        <h3 className="text-sm font-medium mb-3">
                            Imóveis similares ({data.similar_properties?.items?.length || 0})
                        </h3>
                        {data.similar_properties?.items && data.similar_properties.items.length > 0 ? (
                            <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto max-h-80">
                                {JSON.stringify(data.similar_properties.items.slice(0, 5), null, 2)}
                            </pre>
                        ) : (
                            <p className="text-sm text-muted-foreground">Nenhum vizinho encontrado.</p>
                        )}
                    </Card>

                    <Card className="p-4">
                        <h3 className="text-sm font-medium mb-3">Distribuição mensal da meta</h3>
                        {data.meta_distribuicao_mensal?.items && data.meta_distribuicao_mensal.items.length > 0 ? (
                            <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto max-h-80">
                                {JSON.stringify(data.meta_distribuicao_mensal.items, null, 2)}
                            </pre>
                        ) : (
                            <p className="text-sm text-muted-foreground">Pipeline ainda não calculou.</p>
                        )}
                    </Card>
                </TabsContent>

                {/* Estudo PDF inline */}
                <TabsContent value="estudo">
                    <PdfPreview src={`/api/onboarding/${id}/pricing-pdf`} title="Estudo de Rentabilidade" />
                    {data.pdf_url && data.pdf_url.startsWith("http") && (
                        <p className="text-xs text-muted-foreground mt-2">
                            Versão no Drive:{" "}
                            <a href={data.pdf_url} target="_blank" rel="noopener" className="text-sky-600 hover:underline">
                                {data.pdf_url}
                            </a>
                        </p>
                    )}
                </TabsContent>

                {/* Pitchdeck PDF inline */}
                <TabsContent value="pitchdeck">
                    <PdfPreview src={`/api/onboarding/${id}/pitchdeck-pdf`} title="Pitchdeck Qavi.imob" />
                    {data.pitchdeck_pdf_url && data.pitchdeck_pdf_url.startsWith("http") && (
                        <p className="text-xs text-muted-foreground mt-2">
                            Versão no Drive:{" "}
                            <a href={data.pitchdeck_pdf_url} target="_blank" rel="noopener" className="text-sky-600 hover:underline">
                                {data.pitchdeck_pdf_url}
                            </a>
                        </p>
                    )}
                </TabsContent>

                {/* Sugestões Price.OS */}
                <TabsContent value="sugestoes" className="space-y-4">
                    <Card className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium">Baserate sugerido</h3>
                            <Badge variant="outline" className="text-xs">mediana sub_grupo, últimos 30d</Badge>
                        </div>
                        <p className="text-2xl font-semibold">{formatBRL(data.suggested_baserate)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Aprovação criará registro em <span className="font-mono">pricing/periods</span> (F7).
                        </p>
                    </Card>

                    <Card className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium">
                                Basket de concorrentes
                                {data.suggested_basket?.items && (
                                    <span className="text-muted-foreground ml-2">
                                        ({data.suggested_basket.items.length} unidades)
                                    </span>
                                )}
                            </h3>
                            <Badge variant="outline" className="text-xs">
                                raio {data.suggested_basket?.raio_km ?? "—"}km · {data.suggested_basket?.hospedes_alvo ?? "—"} hósp.
                            </Badge>
                        </div>
                        {data.suggested_basket?.items && data.suggested_basket.items.length > 0 ? (
                            <div className="divide-y border rounded">
                                {data.suggested_basket.items.slice(0, 10).map((item, i) => (
                                    <div key={i} className="p-2 flex items-center gap-3 text-sm">
                                        <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                                        <span className="flex-1 truncate">{item.nome_anuncio || "—"}</span>
                                        <span className="text-xs text-muted-foreground w-16 text-right">
                                            {item.distancia_km?.toFixed(2)}km
                                        </span>
                                        <span className="text-xs font-medium w-20 text-right">
                                            {item.preco_por_noite ? formatBRL(item.preco_por_noite) : "—"}
                                        </span>
                                        {item.url_anuncio && (
                                            <a
                                                href={item.url_anuncio}
                                                target="_blank"
                                                rel="noopener"
                                                className="text-sky-600 hover:text-sky-700"
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Nenhuma sugestão encontrada (sem coordenadas ou sem vizinhos no raio).
                            </p>
                        )}
                    </Card>

                    <Card className="p-4">
                        <h3 className="text-sm font-medium mb-3">Sazonalidade padrão</h3>
                        {data.suggested_sazonalidades ? (
                            <div className="text-sm space-y-2">
                                <p>
                                    <span className="font-medium">{data.suggested_sazonalidades.seasonality_name}</span>{" "}
                                    <span className="text-muted-foreground">
                                        ({data.suggested_sazonalidades.praca})
                                    </span>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {data.suggested_sazonalidades.periods?.length || 0} períodos definidos
                                </p>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Nenhuma sazonalidade vinculada à praça.
                            </p>
                        )}
                    </Card>

                    <Card className="p-4">
                        <h3 className="text-sm font-medium mb-3">Listing Airbnb pré-existente</h3>
                        {data.matched_airbnb_listing ? (
                            <a
                                href={data.matched_airbnb_listing}
                                target="_blank"
                                rel="noopener"
                                className="text-sm text-sky-600 hover:underline break-all flex items-start gap-2"
                            >
                                <ExternalLink className="h-3 w-3 mt-1 shrink-0" />
                                {data.matched_airbnb_listing}
                            </a>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Nenhuma correspondência (≤200m + capacidade compatível).
                            </p>
                        )}
                    </Card>

                    <Card className="p-4 bg-amber-50/50 border-amber-200/60 dark:bg-amber-950/20">
                        <p className="text-sm">
                            <strong>F7 (próxima):</strong> botão "Ativar unidade" criará os derivados
                            aprovados (basket em <span className="font-mono">competitor_baskets</span>,
                            baserate, sazonalidades) e a unidade passará a aparecer nas Views.
                        </p>
                    </Card>
                </TabsContent>

                {/* Histórico */}
                <TabsContent value="historico">
                    <Card className="p-0 overflow-hidden">
                        {events.length === 0 ? (
                            <div className="p-6 text-sm text-muted-foreground text-center">
                                Nenhum evento registrado.
                            </div>
                        ) : (
                            <div className="divide-y">
                                {events.map((ev) => (
                                    <div key={ev.id} className="p-3 flex items-start gap-3 text-sm">
                                        <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                                            {ev.event_type}
                                        </Badge>
                                        <div className="flex-1 min-w-0">
                                            {ev.payload && (
                                                <pre className="text-xs text-muted-foreground overflow-x-auto">
                                                    {JSON.stringify(ev.payload, null, 0)}
                                                </pre>
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground shrink-0">
                                            {formatDateTime(ev.created_at)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Timeline rodapé */}
            <Card className="p-3 text-xs text-muted-foreground">
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                    <span>Recebido: {formatDateTime(data.created_at)}</span>
                    <span>Enriquecido: {formatDateTime(data.enriched_at)}</span>
                    <span>Ativado: {formatDateTime(data.activated_at)}</span>
                    {data.operator_email && <span>Operador: {data.operator_email}</span>}
                    <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {payload.localidade || "—"}
                    </span>
                </div>
            </Card>
        </div>
    )
}

// ============================================
// Sub-componentes
// ============================================

function Field({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) {
    return (
        <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground flex items-center gap-1">
                {icon} {label}
            </dt>
            <dd className="font-medium">{value || "—"}</dd>
        </div>
    )
}

function KpiCard({ label, value }: { label: string; value: string }) {
    return (
        <Card className="p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
            <div className="text-lg font-semibold mt-1">{value}</div>
        </Card>
    )
}

function PdfPreview({ src, title }: { src: string; title: string }) {
    const [loaded, setLoaded] = React.useState(false)
    const [errored, setErrored] = React.useState(false)
    return (
        <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b">
                <h3 className="text-sm font-medium">{title}</h3>
                <a
                    href={src}
                    target="_blank"
                    rel="noopener"
                    className="text-xs text-sky-600 hover:underline"
                >
                    Abrir em nova aba ↗
                </a>
            </div>
            <div className="relative bg-muted/30" style={{ height: "75vh" }}>
                {!loaded && !errored && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                )}
                {errored && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                        <AlertCircle className="h-6 w-6 text-destructive" />
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
            <Separator />
        </Card>
    )
}
