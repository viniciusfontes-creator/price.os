"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Calendar, Link2, AlertCircle, CheckCircle2, Loader2, RefreshCw,
} from "lucide-react"

interface Region {
    _id: string
    name: string
}

interface Sazonalidade {
    id: string
    name: string
    stays_region_id: string | null
    stays_region_name: string | null
    pracas: string[]
    period_count: number
}

interface SazoData {
    seasonalities: Sazonalidade[]
    regions: Region[]
    regionsError: string | null
}

const fetcher = (url: string) =>
    fetch(url).then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<SazoData>
    })

export default function SazonalidadesAdminPage() {
    const { data, error, isLoading, mutate } = useSWR<SazoData>(
        "/api/admin/sazonalidades",
        fetcher,
    )
    const [saving, setSaving] = useState<string | null>(null)

    async function saveRegion(seasonalityId: string, regionId: string | null) {
        setSaving(seasonalityId)
        try {
            await fetch(`/api/admin/sazonalidades/${seasonalityId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stays_region_id: regionId }),
            })
            await mutate()
        } finally {
            setSaving(null)
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Calendar className="h-7 w-7 text-muted-foreground" />
                    <div>
                        <h1 className="text-2xl font-semibold">Sazonalidades</h1>
                        <p className="text-sm text-muted-foreground">
                            Associação entre sazonalidades do Price.OS e regions de preço da Stays
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => mutate()}
                    disabled={isLoading}
                >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Atualizar
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                        Mapping atual (Short-Stay)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading && (
                        <div className="space-y-2">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    )}

                    {error && (
                        <div className="text-sm text-red-600 p-3">
                            Falha ao carregar: {String(error)}
                        </div>
                    )}

                    {data?.regionsError && (
                        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 rounded mb-4">
                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>
                                Não consegui listar as regions na Stays:{" "}
                                <code className="text-xs">{data.regionsError}</code>
                            </span>
                        </div>
                    )}

                    {data && (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Sazonalidade</TableHead>
                                    <TableHead>Praças</TableHead>
                                    <TableHead>Periods</TableHead>
                                    <TableHead>Region Stays</TableHead>
                                    <TableHead className="text-right">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.seasonalities.map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell className="font-medium">{s.name}</TableCell>
                                        <TableCell className="text-xs">
                                            <div className="flex flex-wrap gap-1">
                                                {s.pracas.length === 0 ? (
                                                    <span className="text-muted-foreground">—</span>
                                                ) : (
                                                    s.pracas.map((p) => (
                                                        <Badge key={p} variant="secondary" className="text-xs">
                                                            {p}
                                                        </Badge>
                                                    ))
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm tabular-nums">
                                            {s.period_count}
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={s.stays_region_id ?? "__none__"}
                                                onValueChange={(v) =>
                                                    saveRegion(s.id, v === "__none__" ? null : v)
                                                }
                                                disabled={saving === s.id || !data.regions.length}
                                            >
                                                <SelectTrigger className="w-72">
                                                    <SelectValue placeholder="Selecionar region..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">
                                                        <span className="text-muted-foreground">—</span>
                                                    </SelectItem>
                                                    {data.regions.map((r) => (
                                                        <SelectItem key={r._id} value={r._id}>
                                                            {r.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {saving === s.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin ml-auto text-muted-foreground" />
                                            ) : s.stays_region_id ? (
                                                <CheckCircle2 className="h-4 w-4 ml-auto text-green-600" />
                                            ) : (
                                                <AlertCircle className="h-4 w-4 ml-auto text-amber-600" />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
                <CardContent className="py-4 text-sm space-y-1">
                    <p className="font-medium">Como isso é usado</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
                        <li>
                            O pipeline de onboarding lê o vínculo desta tela para sugerir a Region
                            certa quando uma unidade nova entra
                        </li>
                        <li>
                            A aba Pricing usa esta associação para descobrir quais seasons da Stays
                            correspondem aos periods configurados em <code>seasonality_periods</code>
                        </li>
                        <li>
                            Apenas regions <b>Short-Stay</b> estão no escopo atual. Hotelaria/Mensalista
                            virão depois.
                        </li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    )
}
