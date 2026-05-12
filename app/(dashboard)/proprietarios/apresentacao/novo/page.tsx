"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronsUpDown, FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useDashboardData } from "@/contexts/dashboard-provider"

function defaultMonth(): string {
  // mês anterior ao corrente, formato YYYY-MM
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() - 1)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

function monthBounds(mes: string): { ini: string; fim: string } {
  const [y, m] = mes.split("-").map((v) => parseInt(v, 10))
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return {
    ini: `${mes}-01`,
    fim: `${mes}-${String(last).padStart(2, "0")}`,
  }
}

export default function NovoRelatorioPage() {
  const router = useRouter()
  const { data: properties, loading } = useDashboardData()

  const [propOpen, setPropOpen] = React.useState(false)
  const [idprop, setIdprop] = React.useState("")
  const [mes, setMes] = React.useState(defaultMonth())
  const [submitting, setSubmitting] = React.useState(false)

  const selected = properties.find((p) => p.propriedade.idpropriedade === idprop)

  async function handleSubmit() {
    if (!idprop) {
      toast.error("Selecione uma unidade")
      return
    }
    if (!/^\d{4}-\d{2}$/.test(mes)) {
      toast.error("Mês inválido")
      return
    }
    setSubmitting(true)
    const { ini, fim } = monthBounds(mes)
    try {
      const res = await fetch("/api/reports/owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idpropriedade: idprop, ini, fim }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || "Falha ao gerar rascunho")
        return
      }
      toast.success("Rascunho criado")
      router.push(`/proprietarios/apresentacao/${json.data.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <FileText className="h-6 w-6 text-sky-500" />
          Novo Relatório do Proprietário
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione uma unidade e o período. Geramos um rascunho que você poderá editar antes de
          baixar o PDF.
        </p>
      </div>

      <div className="space-y-6 rounded-lg border bg-card p-6">
        <div className="space-y-2">
          <Label>Unidade</Label>
          <Popover open={propOpen} onOpenChange={setPropOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={propOpen}
                className="w-full justify-between font-normal"
                disabled={loading}
              >
                {loading
                  ? "Carregando unidades…"
                  : selected
                    ? `${selected.propriedade.nomepropriedade} · ${selected.propriedade.praca}`
                    : "Selecionar unidade"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar por nome, praça ou ID…" />
                <CommandList>
                  <CommandEmpty>Nenhuma unidade encontrada.</CommandEmpty>
                  <CommandGroup>
                    {properties.map((p) => {
                      const prop = p.propriedade
                      const label = `${prop.nomepropriedade} · ${prop.praca} · ${prop.idpropriedade}`
                      return (
                        <CommandItem
                          key={prop.idpropriedade}
                          value={label}
                          onSelect={() => {
                            setIdprop(prop.idpropriedade)
                            setPropOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              idprop === prop.idpropriedade ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm">{prop.nomepropriedade}</span>
                            <span className="text-xs text-muted-foreground">
                              {prop.praca} · {prop.idpropriedade}
                            </span>
                          </div>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mes">Mês de referência</Label>
          <Input
            id="mes"
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="w-48"
          />
          <p className="text-xs text-muted-foreground">
            O período coberto será do primeiro ao último dia do mês selecionado.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="ghost" onClick={() => router.push("/proprietarios/apresentacao")}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !idprop}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gerar rascunho
          </Button>
        </div>
      </div>
    </div>
  )
}
