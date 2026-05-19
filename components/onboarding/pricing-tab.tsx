"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
    AlertCircle, CheckCircle2, Loader2, MapPin, Sparkles, Zap, Info,
    Copy, Layers, ArrowDownRight, Users,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types (espelham a resposta de GET /api/onboarding/[id]/pricing)
// ---------------------------------------------------------------------------

interface SnapshotSeason {
    _idseason: string
    _idlisting: string
    from: string
    to: string
    baseRateValue: number
    type: "global" | "individual"
    status: string
    ratePlans: Array<{ minStay: number; _i_percent: number; _f_val?: number }>
    monthlyRate?: { minStay: number; _f_val: number }
}

interface ConfigSeason {
    _idseason: string
    from?: string
    to?: string
    current_base_rate?: number | null
    suggested_base_rate?: number | null
    approved_base_rate?: number | null
    approved_monthly_rate?: number | null
    reason?: string
    needs_monthly_rate?: boolean
}

interface MirrorInfo {
    role: "standalone" | "master" | "follower"
    children?: Array<{ idlisting: string; internalName: string; visible: boolean }>
    master_listing_id?: string
    master_name?: string
    group_type?: "clone" | "price"
}

interface PricingData {
    idpropriedade: string
    state: string
    stays_listing_id: string | null
    stays_region_id: string | null
    stays_region_name: string | null
    snapshot_seasons: SnapshotSeason[]
    mirror: MirrorInfo | null
    pricing_config: {
        mode: "manual" | "mirror" | "keep_current"
        mirror_source_idpropriedade?: string | null
        seasons: ConfigSeason[]
    } | null
    sync: {
        status: "pending" | "syncing" | "synced" | "partial" | "error" | "dry_run"
        synced_at: string | null
        errors: { items?: Array<{ seasonId: string; status: number; message: string; needsMonthlyRate: boolean }> } | null
    }
}

const fetcher = (url: string) =>
    fetch(url).then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<PricingData>
    })

function fmtBRL(v: number | null | undefined) {
    if (v == null) return "—"
    return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 })
}

function fmtDate(d: string) {
    const dt = new Date(d + "T00:00:00Z")
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" })
}

// ---------------------------------------------------------------------------

interface Props {
    onboardingId: string
}

export function PricingTab({ onboardingId }: Props) {
    const { data, error, isLoading, mutate } = useSWR<PricingData>(
        `/api/onboarding/${onboardingId}/pricing`,
        fetcher,
    )

    // Local edits (operador digita → debounce → PUT)
    const [edits, setEdits] = useState<Record<string, { base?: string; monthly?: string }>>({})
    const [saving, setSaving] = useState(false)
    const [activating, setActivating] = useState(false)
    const [lastApplyResult, setLastApplyResult] = useState<{
        successes: number
        failures: number
        dry_run: boolean
        failure_details?: Array<{ seasonId: string; status: number; message: string }>
    } | null>(null)

    const saveTimer = useRef<NodeJS.Timeout | null>(null)

    // ----- Render skeleton/erro -----
    if (isLoading) {
        return (
            <div className="space-y-4 animate-in fade-in duration-500">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        )
    }
    if (error || !data) {
        return (
            <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Falha ao carregar pricing. {String(error)}
                </CardContent>
            </Card>
        )
    }

    const loaded = data!
    const seasons = loaded.pricing_config?.seasons ?? []
    const hasStaysData = !!loaded.stays_listing_id && seasons.length > 0
    // Heurística: se snapshot retornou 0 seasons, a unidade NÃO está vinculada
    // à region sugerida na Stays (provavelmente está em "Padrão" — uma region
    // vazia/default que não tem templates configurados).
    const regionIsRealLink = loaded.snapshot_seasons.length > 0
    const regionLabel = regionIsRealLink ? "Região vinculada no PMS" : "Região sugerida (não vinculada)"

    // ----- Auto-save com debounce 800ms -----
    function scheduleSave(newEdits: Record<string, { base?: string; monthly?: string }>) {
        if (saveTimer.current) clearTimeout(saveTimer.current)
        const cfg = loaded.pricing_config
        const snapshotSeasons = seasons
        saveTimer.current = setTimeout(async () => {
            setSaving(true)
            const payload = {
                mode: cfg?.mode ?? "manual",
                mirror_source_idpropriedade: cfg?.mirror_source_idpropriedade ?? null,
                seasons: snapshotSeasons.map((s) => {
                    const e = newEdits[s._idseason]
                    return {
                        _idseason: s._idseason,
                        approved_base_rate: e?.base ? Number(e.base.replace(",", ".")) : s.approved_base_rate ?? null,
                        approved_monthly_rate: e?.monthly ? Number(e.monthly.replace(",", ".")) : s.approved_monthly_rate ?? null,
                    }
                }),
            }
            try {
                await fetch(`/api/onboarding/${onboardingId}/pricing`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                })
                await mutate()
            } finally {
                setSaving(false)
            }
        }, 800)
    }

    function setEdit(seasonId: string, field: "base" | "monthly", value: string) {
        setEdits((prev) => {
            const next = { ...prev, [seasonId]: { ...prev[seasonId], [field]: value } }
            scheduleSave(next)
            return next
        })
    }

    // ----- Apply (Activate Unit) -----
    async function applyAll() {
        setActivating(true)
        setLastApplyResult(null)
        try {
            const res = await fetch(`/api/onboarding/${onboardingId}/activate-pricing`, {
                method: "POST",
            })
            const body = await res.json()
            setLastApplyResult({
                successes: body.successes ?? 0,
                failures: body.failures ?? 0,
                dry_run: !!body.dry_run,
                failure_details: body.failure_details,
            })
            await mutate()
        } finally {
            setActivating(false)
        }
    }

    // ----- Stats -----
    const filledCount = seasons.filter(
        (s) => (s.approved_base_rate ?? s.suggested_base_rate ?? 0) > 0,
    ).length
    const totalCount = seasons.length

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Status Stays */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            Integração com Stays
                        </CardTitle>
                        <SyncBadge status={loaded.sync.status} />
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Stat label="Listing ID (Stays)">
                        <code className="text-xs">{loaded.stays_listing_id ?? "—"}</code>
                    </Stat>
                    <Stat label={regionLabel}>
                        <span className={regionIsRealLink ? "" : "text-amber-700 dark:text-amber-400"}>
                            {loaded.stays_region_name ?? "—"}
                        </span>
                    </Stat>
                    <Stat label="Seasons detectadas">
                        <span className="tabular-nums">{seasons.length}</span>
                    </Stat>
                    <Stat label="Aprovação preenchida">
                        <span className="tabular-nums">{filledCount}/{totalCount}</span>
                    </Stat>
                </CardContent>
            </Card>

            {/* Card Espelhamento */}
            {loaded.mirror && (
                <MirrorCard mirror={loaded.mirror} listingId={loaded.stays_listing_id} />
            )}

            {!hasStaysData && (
                <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200">
                    <CardContent className="py-4 space-y-3">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm">
                                <p className="font-medium">
                                    A unidade não está vinculada a nenhuma região no PMS Stays
                                </p>
                                <p className="text-muted-foreground mt-1">
                                    Na Stays, a unidade está em <code className="text-xs bg-amber-100 dark:bg-amber-900 px-1 rounded">Padrão</code> (sem templates).
                                    Sugerimos <b>{loaded.stays_region_name ?? "—"}</b> com base na
                                    sazonalidade da praça.
                                </p>
                                <p className="text-xs text-muted-foreground mt-2">
                                    <b>Passos:</b> Stays → Anúncio → Financeiro → Configuração geral
                                    de preço → escolher Região → Salvar → voltar aqui e Reprocessar.
                                </p>
                            </div>
                        </div>
                        <a
                            href={`https://beto.stays.com.br/admin/listings`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 hover:underline"
                        >
                            Abrir no Stays →
                        </a>
                    </CardContent>
                </Card>
            )}

            {/* Tabela de seasons */}
            {hasStaysData && (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-muted-foreground" />
                                Pricing por season ({totalCount})
                            </CardTitle>
                            {saving && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" /> salvando...
                                </span>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Período</TableHead>
                                    <TableHead className="text-right">Atual</TableHead>
                                    <TableHead className="text-right">Sugerido</TableHead>
                                    <TableHead className="text-right">Aprovado pelo operador</TableHead>
                                    <TableHead>Lógica</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {seasons.map((s) => (
                                    <SeasonRow
                                        key={s._idseason}
                                        season={s}
                                        edit={edits[s._idseason]}
                                        onChange={(field, value) => setEdit(s._idseason, field, value)}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Aplicar */}
            {hasStaysData && (
                <Card>
                    <CardContent className="py-6 space-y-3">
                        {lastApplyResult && <ApplyResult result={lastApplyResult} />}
                        <div className="flex items-center justify-between gap-4">
                            <p className="text-xs text-muted-foreground max-w-2xl">
                                Ao clicar em <b>Ativar Unidade</b>, o Price.OS dispara um PATCH por
                                season no endpoint <code>/parr/listing-rates-sell</code> da Stays.
                                Em modo dry-run (ambiente atual), simula sem alterar o PMS real.
                            </p>
                            <Button
                                onClick={applyAll}
                                disabled={activating || filledCount === 0}
                                size="lg"
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {activating ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aplicando...</>
                                ) : (
                                    <><Zap className="h-4 w-4 mr-2" /> Ativar Unidade ({filledCount} seasons)</>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SeasonRow({
    season,
    edit,
    onChange,
}: {
    season: ConfigSeason
    edit?: { base?: string; monthly?: string }
    onChange: (field: "base" | "monthly", value: string) => void
}) {
    const current = season.current_base_rate
    const suggested = season.suggested_base_rate
    const approved =
        edit?.base !== undefined ? edit.base : season.approved_base_rate?.toString() ?? ""
    const isPremium = season.reason?.toLowerCase().includes("réveillon") ||
        season.reason?.toLowerCase().includes("carnaval")

    return (
        <TableRow>
            <TableCell>
                <div className="font-medium text-sm">
                    {season.from && season.to ? `${fmtDate(season.from)} → ${fmtDate(season.to)}` : "—"}
                </div>
                {isPremium && <Badge variant="secondary" className="mt-1 text-xs bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">premium</Badge>}
            </TableCell>
            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                {fmtBRL(current)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-sm">
                {fmtBRL(suggested)}
            </TableCell>
            <TableCell className="text-right">
                <Input
                    type="text"
                    placeholder={suggested ? suggested.toString() : "valor"}
                    value={approved}
                    onChange={(e) => onChange("base", e.target.value)}
                    className="w-28 text-right tabular-nums ml-auto"
                />
            </TableCell>
            <TableCell className="max-w-[200px] text-xs text-muted-foreground">
                {season.reason ?? "—"}
            </TableCell>
        </TableRow>
    )
}

function MirrorCard({ mirror, listingId }: { mirror: MirrorInfo; listingId: string | null }) {
    if (mirror.role === "standalone") {
        return (
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        Espelhamento
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Unidade autônoma — não compartilha preço com nenhuma outra.
                    </span>
                </CardContent>
            </Card>
        )
    }

    if (mirror.role === "follower") {
        return (
            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <ArrowDownRight className="h-4 w-4 text-blue-600" />
                        Esta unidade espelha outra
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <p>
                        Preço é definido pela unidade-mãe:{" "}
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {mirror.master_name ?? mirror.master_listing_id}
                        </code>
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Alterações feitas aqui não terão efeito direto — mude o preço da unidade-mãe
                        para refletir aqui automaticamente.
                    </p>
                </CardContent>
            </Card>
        )
    }

    // master
    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        Esta é uma unidade-mãe
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                        {mirror.group_type === "clone" ? "Clone Group" : "Price Group"}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                    {mirror.children?.length ?? 0} unidades filhas seguem o preço desta unidade:
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {(mirror.children ?? []).map((c) => (
                        <div
                            key={c.idlisting}
                            className="flex items-center justify-between text-xs px-3 py-2 bg-muted/40 rounded"
                        >
                            <span className="font-mono truncate flex-1">{c.internalName}</span>
                            <code className="text-[10px] text-muted-foreground ml-2">{c.idlisting.slice(0, 8)}</code>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    Ao editar preços abaixo, as {mirror.children?.length ?? 0} filhas refletem automaticamente.
                </p>
            </CardContent>
        </Card>
    )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className="text-sm font-medium">{children}</div>
        </div>
    )
}

function SyncBadge({ status }: { status: PricingData["sync"]["status"] }) {
    const config: Record<typeof status, { label: string; cls: string; icon?: React.ElementType }> = {
        pending: { label: "Pendente", cls: "bg-gray-100 text-gray-700" },
        syncing: { label: "Sincronizando", cls: "bg-blue-100 text-blue-700", icon: Loader2 },
        synced: { label: "Sincronizado", cls: "bg-green-100 text-green-700", icon: CheckCircle2 },
        partial: { label: "Parcial", cls: "bg-amber-100 text-amber-700", icon: AlertCircle },
        error: { label: "Erro", cls: "bg-red-100 text-red-700", icon: AlertCircle },
        dry_run: { label: "Dry-run", cls: "bg-purple-100 text-purple-700", icon: Info },
    }
    const c = config[status]
    const Icon = c.icon
    return (
        <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium", c.cls)}>
            {Icon && <Icon className={cn("h-3 w-3", status === "syncing" && "animate-spin")} />}
            {c.label}
        </span>
    )
}

function ApplyResult({ result }: { result: { successes: number; failures: number; dry_run: boolean; failure_details?: Array<{ seasonId: string; status: number; message: string }> } }) {
    if (result.failures === 0) {
        return (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                {result.dry_run
                    ? `Dry-run OK: ${result.successes} PATCHes simulados sem tocar Stays`
                    : `Sucesso: ${result.successes} seasons aplicadas na Stays`}
            </div>
        )
    }
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                Parcial: {result.successes} OK, {result.failures} com erro
            </div>
            {result.failure_details && result.failure_details.length > 0 && (
                <ul className="text-xs space-y-1 ml-6">
                    {result.failure_details.slice(0, 5).map((f, i) => (
                        <li key={i} className="text-muted-foreground">
                            • Season <code>{f.seasonId.slice(0, 8)}</code> · HTTP {f.status} · {f.message.slice(0, 100)}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
