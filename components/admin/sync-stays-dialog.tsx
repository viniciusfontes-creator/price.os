"use client"

import { useState, useEffect, useMemo } from "react"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, Info } from "lucide-react"

interface Match {
    price_os_period: {
        id: string
        name: string
        start_date: string
        end_date: string
        type: string
    }
    stays_template: {
        _id: string
        name: string
        from: string
        to: string
        type: string
    } | null
    confidence: "high" | "medium" | "low" | "none"
    proposed_rule: { kind: string; [k: string]: unknown } | null
    current_mapping?: { stays_template_id?: string; rule?: unknown } | null
    // Anexo pelo componente (Index na lista de seasonality_periods retornada)
    sp_id?: string
}

interface SyncData {
    seasonality: { id: string; name: string; stays_region_id: string }
    matches: Match[]
    stays_only: Array<{ _id: string; name: string; from: string; to: string; type: string }>
    summary: { matched: number; price_only: number; stays_only: number }
}

interface Props {
    seasonalityId: string | null
    seasonalityName: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onSaved?: () => void
}

function ConfBadge({ c }: { c: Match["confidence"] }) {
    const conf = {
        high: { label: "Alta", cls: "bg-green-100 text-green-800" },
        medium: { label: "Média", cls: "bg-amber-100 text-amber-800" },
        low: { label: "Baixa", cls: "bg-orange-100 text-orange-800" },
        none: { label: "Sem match", cls: "bg-red-100 text-red-800" },
    }[c]
    return <Badge variant="secondary" className={`text-xs ${conf.cls}`}>{conf.label}</Badge>
}

function ruleSummary(r: Match["proposed_rule"]): string {
    if (!r) return "—"
    const k = r.kind as string
    if (k === "month_full") return `mês ${r.month}`
    if (k === "fixed")
        return `${String(r.day_start).padStart(2, "0")}/${String(r.month_start).padStart(2, "0")} +${r.duration_days}d`
    if (k === "easter_offset") {
        const off = r.offset_days as number
        return `Páscoa ${off > 0 ? "+" : ""}${off}d +${r.duration_days}d`
    }
    return k
}

export function SyncStaysDialog({ seasonalityId, seasonalityName, open, onOpenChange, onSaved }: Props) {
    const [data, setData] = useState<SyncData | null>(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open || !seasonalityId) return
        setLoading(true)
        setError(null)
        setData(null)
        fetch(`/api/admin/sazonalidades/${seasonalityId}/sync-stays`)
            .then(async (r) => {
                if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`)
                return r.json()
            })
            .then((d) => setData(d))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
    }, [open, seasonalityId])

    const staysOnlyRecent = useMemo(() => {
        if (!data) return []
        const currentYear = new Date().getUTCFullYear()
        return data.stays_only.filter((t) => Number(t.from.slice(0, 4)) >= currentYear)
    }, [data])

    async function save() {
        if (!data || !seasonalityId) return
        setSaving(true)
        try {
            const mappings = data.matches
                .filter((m) => m.stays_template && m.proposed_rule)
                .map((m) => ({
                    seasonality_period_sp_id: (m as Match & { sp_id?: string }).sp_id ?? m.price_os_period.id,
                    stays_template_id: m.stays_template!._id,
                    rule: m.proposed_rule,
                    current: { from: m.stays_template!.from, to: m.stays_template!.to },
                }))
            await fetch(`/api/admin/sazonalidades/${seasonalityId}/sync-stays`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mappings }),
            })
            onSaved?.()
            onOpenChange(false)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Sincronizar com Stays — {seasonalityName}</DialogTitle>
                    <DialogDescription>
                        Mapping automático de periods do Price.OS para templates da region na Stays.
                        Revise as inferências e clique em Salvar para persistir.
                    </DialogDescription>
                </DialogHeader>

                {loading && (
                    <div className="space-y-2 py-4">
                        <Skeleton className="h-8 w-1/2" />
                        <Skeleton className="h-32 w-full" />
                    </div>
                )}

                {error && (
                    <div className="text-sm text-red-600 p-3 bg-red-50 rounded">
                        Erro: {error}
                    </div>
                )}

                {data && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3 text-sm">
                            <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded">
                                <div className="text-xs text-muted-foreground">Mapeados</div>
                                <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                                    {data.summary.matched}
                                </div>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded">
                                <div className="text-xs text-muted-foreground">Só no Price.OS</div>
                                <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                                    {data.summary.price_only}
                                </div>
                            </div>
                            <div className="bg-muted p-3 rounded">
                                <div className="text-xs text-muted-foreground">Só na Stays</div>
                                <div className="text-2xl font-bold text-muted-foreground">
                                    {data.summary.stays_only}
                                </div>
                            </div>
                        </div>

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Period (Price.OS)</TableHead>
                                    <TableHead></TableHead>
                                    <TableHead>Template (Stays)</TableHead>
                                    <TableHead>Confiança</TableHead>
                                    <TableHead>Regra inferida</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.matches.map((m, i) => (
                                    <TableRow key={i}>
                                        <TableCell>
                                            <div className="font-medium text-sm">{m.price_os_period.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {m.price_os_period.start_date} → {m.price_os_period.end_date}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                        </TableCell>
                                        <TableCell>
                                            {m.stays_template ? (
                                                <>
                                                    <div className="text-sm">{m.stays_template.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {m.stays_template.from} → {m.stays_template.to}
                                                    </div>
                                                </>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell><ConfBadge c={m.confidence} /></TableCell>
                                        <TableCell className="text-xs font-mono text-muted-foreground">
                                            {ruleSummary(m.proposed_rule)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        {staysOnlyRecent.length > 0 && (
                            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded p-3 text-xs">
                                <div className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300 mb-2">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    {staysOnlyRecent.length} templates ativos na Stays sem par no Price.OS (≥{new Date().getUTCFullYear()})
                                </div>
                                <div className="text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                                    {staysOnlyRecent.slice(0, 15).map((t) => (
                                        <div key={t._id}>• {t.name} ({t.from} → {t.to})</div>
                                    ))}
                                    {staysOnlyRecent.length > 15 && (
                                        <div className="text-muted-foreground/70">+ {staysOnlyRecent.length - 15} outros</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={save} disabled={!data || saving}>
                        {saving ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                        ) : (
                            <><CheckCircle2 className="h-4 w-4 mr-2" /> Salvar matches aprovados</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
