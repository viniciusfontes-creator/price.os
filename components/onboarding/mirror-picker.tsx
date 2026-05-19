"use client"

import { useState } from "react"
import useSWR from "swr"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { Layers, Loader2 } from "lucide-react"

interface MasterCandidate {
    _id: string
    id: string
    _adr?: { str?: string; num?: string; region?: string; city?: string }
}

interface Props {
    onboardingId: string
    regionId: string | null
    excludeListingId: string
    onChanged: () => void
}

const fetcher = (url: string) =>
    fetch(url).then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = await r.json()
        return (j.candidates ?? []) as MasterCandidate[]
    })

function formatAddress(c: MasterCandidate): string {
    const a = c._adr
    if (!a) return c.id
    return [a.str, a.num, a.region, a.city].filter(Boolean).join(", ")
}

export function MirrorPicker({
    onboardingId,
    regionId,
    excludeListingId,
    onChanged,
}: Props) {
    const [open, setOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [confirm, setConfirm] = useState<MasterCandidate | null>(null)

    const swrKey =
        open && regionId
            ? `/api/stays/master-candidates?regionId=${encodeURIComponent(regionId)}&excludeListingId=${encodeURIComponent(excludeListingId)}`
            : null
    const { data: candidates, isLoading } = useSWR<MasterCandidate[]>(swrKey, fetcher)

    async function applyChoice(c: MasterCandidate) {
        setSubmitting(true)
        setError(null)
        try {
            const res = await fetch(`/api/onboarding/${onboardingId}/set-price-mirror`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    masterListingId: c._id,
                    masterName: c.id,
                }),
            })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(body.error ?? `HTTP ${res.status}`)
                return
            }
            setOpen(false)
            setConfirm(null)
            onChanged()
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setSubmitting(false)
        }
    }

    if (!regionId) {
        return (
            <p className="text-xs text-muted-foreground italic">
                Vincule uma região primeiro para listar candidatos a unidade-mãe.
            </p>
        )
    }

    return (
        <Popover
            open={open}
            onOpenChange={(o) => {
                setOpen(o)
                if (!o) {
                    setError(null)
                    setConfirm(null)
                }
            }}
        >
            <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                    <Layers className="h-3.5 w-3.5" />
                    Escolher unidade-mãe
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] p-0" align="start">
                {confirm ? (
                    <div className="p-4 space-y-3 text-sm">
                        <div className="font-medium">Confirmar espelhamento de preço?</div>
                        <p className="text-xs text-muted-foreground">
                            Vou vincular esta unidade como FILHA de{" "}
                            <code className="text-xs bg-muted px-1 rounded">{confirm.id}</code>.
                            A partir daí o preço vem do master continuamente — alterações
                            individuais nesta unidade serão sobrescritas.
                        </p>
                        {error && (
                            <p className="text-xs text-red-600 dark:text-red-400">
                                {error}
                            </p>
                        )}
                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirm(null)}
                                disabled={submitting}
                            >
                                Cancelar
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => applyChoice(confirm)}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        Aplicando…
                                    </>
                                ) : (
                                    "Confirmar"
                                )}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Command>
                        <CommandInput placeholder="Buscar unidade-mãe…" />
                        <CommandList>
                            {isLoading && (
                                <div className="p-4 text-xs text-muted-foreground flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Carregando candidatos…
                                </div>
                            )}
                            {!isLoading && (candidates?.length ?? 0) === 0 && (
                                <CommandEmpty>
                                    Nenhuma unidade elegível nesta região.
                                </CommandEmpty>
                            )}
                            {candidates && candidates.length > 0 && (
                                <CommandGroup>
                                    {candidates.map((c) => (
                                        <CommandItem
                                            key={c._id}
                                            value={`${c.id} ${formatAddress(c)}`}
                                            onSelect={() => setConfirm(c)}
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-medium">{c.id}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatAddress(c)}
                                                </span>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}
                        </CommandList>
                    </Command>
                )}
            </PopoverContent>
        </Popover>
    )
}
