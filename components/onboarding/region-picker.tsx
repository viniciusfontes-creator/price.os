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
import { Check, ChevronsUpDown, Loader2, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"

interface PriceRegion {
    _id: string
    name: string
}

interface Props {
    onboardingId: string
    currentRegionId: string | null
    currentRegionName: string | null
    onChanged: () => void
}

const regionsFetcher = (url: string) =>
    fetch(url).then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = await r.json()
        return (j.regions ?? []) as PriceRegion[]
    })

export function RegionPicker({
    onboardingId,
    currentRegionId,
    currentRegionName,
    onChanged,
}: Props) {
    const [open, setOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [confirm, setConfirm] = useState<PriceRegion | null>(null)

    const { data: regions, isLoading } = useSWR<PriceRegion[]>(
        open ? "/api/stays/price-regions" : null,
        regionsFetcher,
    )

    async function applyChoice(region: PriceRegion) {
        setSubmitting(true)
        setError(null)
        try {
            const res = await fetch(`/api/onboarding/${onboardingId}/set-region`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    regionId: region._id,
                    regionName: region.name,
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
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground gap-1"
                    aria-label="Trocar região"
                >
                    <Pencil className="h-3 w-3" />
                    trocar
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[360px] p-0" align="start">
                {confirm ? (
                    <div className="p-4 space-y-3 text-sm">
                        <div className="font-medium">Confirmar troca de região?</div>
                        <p className="text-xs text-muted-foreground">
                            Vou vincular a unidade a <b>{confirm.name}</b>, recarregar
                            seasons da Stays e aplicar baseRates sugeridos pela IA em
                            cada season nova. <b>As tarifas atuais serão sobrescritas.</b>
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
                        <CommandInput placeholder="Buscar região…" />
                        <CommandList>
                            {isLoading && (
                                <div className="p-4 text-xs text-muted-foreground flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Carregando regiões…
                                </div>
                            )}
                            {!isLoading && (regions?.length ?? 0) === 0 && (
                                <CommandEmpty>Nenhuma região encontrada.</CommandEmpty>
                            )}
                            {regions && regions.length > 0 && (
                                <CommandGroup>
                                    {regions.map((r) => {
                                        const isCurrent = r._id === currentRegionId
                                        return (
                                            <CommandItem
                                                key={r._id}
                                                value={r.name}
                                                onSelect={() => {
                                                    if (isCurrent) return
                                                    setConfirm(r)
                                                }}
                                                disabled={isCurrent}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        isCurrent ? "opacity-100" : "opacity-0",
                                                    )}
                                                />
                                                <span>{r.name}</span>
                                                {isCurrent && (
                                                    <span className="ml-auto text-[10px] text-muted-foreground">
                                                        atual
                                                    </span>
                                                )}
                                            </CommandItem>
                                        )
                                    })}
                                </CommandGroup>
                            )}
                        </CommandList>
                    </Command>
                )}
            </PopoverContent>
        </Popover>
    )
}
