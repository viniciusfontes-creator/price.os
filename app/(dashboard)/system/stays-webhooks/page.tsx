"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { LoadingSpinner } from "@/components/loading-spinner"
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    RefreshCw,
    Webhook,
    Eye,
    RotateCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface WebhookEvent {
    id: string
    received_at: string
    event_type: string | null
    entity_id: string | null
    payload: unknown
    headers: unknown
    processed_at: string | null
    processing_error: string | null
}

interface ListResponse {
    items: WebhookEvent[]
    total: number
    stats: { pending: number; processed: number; error: number }
}

const fetcher = (url: string) =>
    fetch(url).then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<ListResponse>
    })

function formatRelativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime()
    const sec = Math.floor(diffMs / 1000)
    if (sec < 60) return `${sec}s atrás`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}min atrás`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h atrás`
    return `${Math.floor(hr / 24)}d atrás`
}

function formatLatency(received: string, processed: string | null): string {
    if (!processed) return "—"
    const ms = new Date(processed).getTime() - new Date(received).getTime()
    if (ms < 1000) return `${ms}ms`
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60_000)}min`
}

function StatusBadge({ event }: { event: WebhookEvent }) {
    if (event.processing_error) {
        return (
            <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />erro
            </Badge>
        )
    }
    if (event.processed_at) {
        return (
            <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="h-3 w-3" />processado
            </Badge>
        )
    }
    return (
        <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />pendente
        </Badge>
    )
}

export default function StaysWebhooksPage() {
    const [status, setStatus] = useState<string>("all")
    const [eventTypeFilter, setEventTypeFilter] = useState("")
    const [entityIdFilter, setEntityIdFilter] = useState("")
    const [selected, setSelected] = useState<WebhookEvent | null>(null)

    const qs = new URLSearchParams({ status, limit: "100" })
    if (eventTypeFilter) qs.set("event_type", eventTypeFilter)
    if (entityIdFilter) qs.set("entity_id", entityIdFilter)

    const { data, error, isLoading, mutate } = useSWR<ListResponse>(
        `/api/admin/stays-webhooks?${qs.toString()}`,
        fetcher,
        { refreshInterval: 10_000 },
    )

    async function resetEvent(id: string) {
        await fetch(`/api/admin/stays-webhooks/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reset" }),
        })
        mutate()
        setSelected(null)
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Webhook className="h-7 w-7 text-muted-foreground" />
                    <div>
                        <h1 className="text-2xl font-semibold">Webhooks Stays</h1>
                        <p className="text-sm text-muted-foreground">
                            Monitor de eventos recebidos em <code>/api/stays/webhook</code>
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => mutate()}
                    disabled={isLoading}
                >
                    <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                    Atualizar
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    label="Total"
                    value={data?.total ?? 0}
                    icon={<Webhook className="h-4 w-4 text-muted-foreground" />}
                />
                <StatCard
                    label="Pendentes"
                    value={data?.stats.pending ?? 0}
                    icon={<Clock className="h-4 w-4 text-amber-600" />}
                    accent="amber"
                />
                <StatCard
                    label="Processados"
                    value={data?.stats.processed ?? 0}
                    icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
                    accent="green"
                />
                <StatCard
                    label="Com erro"
                    value={data?.stats.error ?? 0}
                    icon={<AlertCircle className="h-4 w-4 text-red-600" />}
                    accent="red"
                />
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Filtros</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="pending">Pendentes</SelectItem>
                            <SelectItem value="processed">Processados</SelectItem>
                            <SelectItem value="error">Com erro</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input
                        placeholder="event_type (ex.: reservation.created)"
                        value={eventTypeFilter}
                        onChange={(e) => setEventTypeFilter(e.target.value)}
                    />
                    <Input
                        placeholder="entity_id (listing/reservation)"
                        value={entityIdFilter}
                        onChange={(e) => setEntityIdFilter(e.target.value)}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                        Eventos ({data?.items.length ?? 0})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="text-sm text-red-600 p-4">
                            Falha ao carregar: {String(error)}
                        </div>
                    )}
                    {isLoading && !data && (
                        <div className="flex justify-center p-8">
                            <LoadingSpinner />
                        </div>
                    )}
                    {data && data.items.length === 0 && (
                        <div className="text-sm text-muted-foreground p-8 text-center">
                            Nenhum evento ainda. Quando a Stays disparar, ele aparece aqui em até 10s.
                        </div>
                    )}
                    {data && data.items.length > 0 && (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Recebido</TableHead>
                                    <TableHead>Evento</TableHead>
                                    <TableHead>Entity ID</TableHead>
                                    <TableHead>Latência</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.items.map((ev) => (
                                    <TableRow
                                        key={ev.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => setSelected(ev)}
                                    >
                                        <TableCell className="text-sm">
                                            <div>{formatRelativeTime(ev.received_at)}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {new Date(ev.received_at).toLocaleString("pt-BR")}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {ev.event_type ? (
                                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                                    {ev.event_type}
                                                </code>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {ev.entity_id ? (
                                                <code className="text-xs">{ev.entity_id}</code>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {formatLatency(ev.received_at, ev.processed_at)}
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge event={ev} />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setSelected(ev)
                                                }}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
                <SheetContent className="sm:max-w-2xl overflow-y-auto">
                    {selected && (
                        <>
                            <SheetHeader>
                                <SheetTitle>Evento {selected.id.slice(0, 8)}</SheetTitle>
                                <SheetDescription>
                                    {new Date(selected.received_at).toLocaleString("pt-BR")}
                                </SheetDescription>
                            </SheetHeader>
                            <div className="space-y-4 mt-4">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <DetailField label="Event type" value={selected.event_type} />
                                    <DetailField label="Entity ID" value={selected.entity_id} />
                                    <DetailField
                                        label="Status"
                                        value={
                                            selected.processing_error
                                                ? "erro"
                                                : selected.processed_at
                                                  ? "processado"
                                                  : "pendente"
                                        }
                                    />
                                    <DetailField
                                        label="Latência"
                                        value={formatLatency(selected.received_at, selected.processed_at)}
                                    />
                                </div>
                                {selected.processing_error && (
                                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded p-3">
                                        <div className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">
                                            Erro de processamento
                                        </div>
                                        <code className="text-xs whitespace-pre-wrap break-all">
                                            {selected.processing_error}
                                        </code>
                                    </div>
                                )}
                                <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">Payload</div>
                                    <pre className="text-xs bg-muted rounded p-3 overflow-x-auto max-h-96">
                                        {JSON.stringify(selected.payload, null, 2)}
                                    </pre>
                                </div>
                                {!!selected.headers && (
                                    <div>
                                        <div className="text-xs font-medium text-muted-foreground mb-1">Headers</div>
                                        <pre className="text-xs bg-muted rounded p-3 overflow-x-auto">
                                            {JSON.stringify(selected.headers, null, 2)}
                                        </pre>
                                    </div>
                                )}
                                {(selected.processed_at || selected.processing_error) && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => resetEvent(selected.id)}
                                    >
                                        <RotateCcw className="h-4 w-4 mr-2" />
                                        Resetar (marcar como pendente)
                                    </Button>
                                )}
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}

function StatCard({
    label,
    value,
    icon,
    accent,
}: {
    label: string
    value: number
    icon: React.ReactNode
    accent?: "amber" | "green" | "red"
}) {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs text-muted-foreground">{label}</div>
                        <div
                            className={cn(
                                "text-2xl font-semibold tabular-nums",
                                accent === "amber" && "text-amber-600",
                                accent === "green" && "text-green-600",
                                accent === "red" && "text-red-600",
                            )}
                        >
                            {value.toLocaleString("pt-BR")}
                        </div>
                    </div>
                    {icon}
                </div>
            </CardContent>
        </Card>
    )
}

function DetailField({ label, value }: { label: string; value: string | null }) {
    return (
        <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="font-mono text-sm">{value ?? "—"}</div>
        </div>
    )
}
