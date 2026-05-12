"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Check, Eye, Loader2, RefreshCw, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { SLIDE_LABELS, type SlideConfig, type SlideKey } from "@/lib/owner-report/templates"
import { cn } from "@/lib/utils"

interface Report {
  id: string
  nome_propriedade: string | null
  periodo_inicio: string
  periodo_fim: string
  slides: SlideConfig[]
  snapshot_data: any
}

/** Quais campos cada slide aceita override de texto. */
const OVERRIDE_FIELDS: Partial<Record<SlideKey, Array<{ key: string; label: string; placeholder: string }>>> = {
  resumo_executivo: [
    {
      key: "intro",
      label: "Parágrafo introdutório",
      placeholder:
        "Visão consolidada da performance do período. Os indicadores abaixo refletem todas as reservas confirmadas…",
    },
  ],
  performance_meta: [
    {
      key: "intro",
      label: "Comentário sobre o desempenho",
      placeholder:
        "No acumulado do ano, a unidade realizou X% das metas previstas. Use esse espaço para contextualizar…",
    },
    {
      key: "nota",
      label: "Nota explicativa (rodapé)",
      placeholder:
        "O acompanhamento da meta considera as receitas com checkout dentro de cada mês…",
    },
  ],
  evolucao_12m: [
    {
      key: "intro",
      label: "Comentário sobre a evolução",
      placeholder:
        "A receita dos últimos 12 meses cresceu X% em relação ao mesmo período do ano anterior…",
    },
  ],
  capa: [
    {
      key: "destaque",
      label: "Frase de destaque",
      placeholder: "Um panorama completo da performance da sua unidade no período.",
    },
  ],
  calendario_ocupacao: [
    {
      key: "intro",
      label: "Comentário sobre a ocupação",
      placeholder: "A ocupação foi de X%, com Y dias bloqueados pelo proprietário…",
    },
  ],
  mix_canais: [
    {
      key: "intro",
      label: "Comentário sobre o mix de canais",
      placeholder: "Airbnb continua sendo o principal canal, respondendo por X% da receita…",
    },
  ],
  conclusao_proximos_passos: [
    { key: "paragrafo1", label: "Parágrafo de conclusão #1", placeholder: "Resumo executivo do período…" },
    { key: "paragrafo2", label: "Parágrafo de conclusão #2", placeholder: "Considerações sobre a estratégia…" },
    { key: "proximo1", label: "Próximo passo #1", placeholder: "Revisar precificação dos próximos meses…" },
    { key: "proximo2", label: "Próximo passo #2", placeholder: "Avaliar bloqueios de proprietário…" },
    { key: "proximo3", label: "Próximo passo #3", placeholder: "Monitorar concorrentes…" },
  ],
  assinatura: [
    {
      key: "mensagem",
      label: "Mensagem final ao proprietário",
      placeholder: "Este relatório foi preparado pela equipe Quarto à Vista…",
    },
    {
      key: "disclaimer",
      label: "Disclaimer (rodapé)",
      placeholder: "Os dados refletem reservas confirmadas no PMS até a data de geração…",
    },
  ],
}

type SaveState = "idle" | "saving" | "saved" | "error"

export default function EditorPage() {
  const { id } = useParams<{ id: string }>()

  const [report, setReport] = React.useState<Report | null>(null)
  const [slides, setSlides] = React.useState<SlideConfig[]>([])
  const [selectedKey, setSelectedKey] = React.useState<SlideKey | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [save, setSave] = React.useState<SaveState>("idle")
  const [previewVersion, setPreviewVersion] = React.useState(0)

  // Carrega o relatório uma vez
  React.useEffect(() => {
    let cancelled = false
    fetch(`/api/reports/owner/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (!j.success) {
          setError(j.error || "Falha ao carregar")
          return
        }
        setReport(j.data)
        setSlides(j.data.slides)
        setSelectedKey(j.data.slides[0]?.key || null)
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  // Auto-save com debounce. Não dispara no carregamento inicial.
  const initialRef = React.useRef(true)
  React.useEffect(() => {
    if (loading || !report) return
    if (initialRef.current) {
      initialRef.current = false
      return
    }
    setSave("saving")
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/reports/owner/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slides }),
        })
        if (!res.ok) throw new Error((await res.json()).error || "Falha ao salvar")
        setSave("saved")
        setPreviewVersion((v) => v + 1)
      } catch (err) {
        setSave("error")
        toast.error(err instanceof Error ? err.message : "Falha ao salvar")
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [slides, id, loading, report])

  const selected = slides.find((s) => s.key === selectedKey)
  const fields = selected ? OVERRIDE_FIELDS[selected.key] : undefined

  function toggleVisible(key: SlideKey) {
    setSlides((prev) => prev.map((s) => (s.key === key ? { ...s, visible: !s.visible } : s)))
  }
  function setOverride(key: SlideKey, field: string, value: string) {
    setSlides((prev) =>
      prev.map((s) =>
        s.key === key
          ? {
              ...s,
              overrides: value
                ? { ...s.overrides, [field]: value }
                : Object.fromEntries(Object.entries(s.overrides).filter(([k]) => k !== field)),
            }
          : s
      )
    )
  }
  function resetOverrides(key: SlideKey) {
    setSlides((prev) => prev.map((s) => (s.key === key ? { ...s, overrides: {} } : s)))
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    )
  }
  if (error || !report) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <p className="text-destructive">{error || "Relatório não encontrado"}</p>
      </div>
    )
  }

  return (
    <div className="-m-6 h-[calc(100vh-3.5rem)] flex flex-col">
      <header className="px-6 py-3 border-b flex items-center justify-between bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/proprietarios/apresentacao/${id}`}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Pré-visualização
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate">
              {report.nome_propriedade}
            </h1>
            <p className="text-xs text-muted-foreground">
              {report.periodo_inicio} → {report.periodo_fim}
            </p>
          </div>
        </div>
        <SaveIndicator state={save} />
      </header>

      <div className="flex-1 grid grid-cols-[260px_minmax(0,1fr)_minmax(0,1.4fr)] min-h-0">
        <aside className="border-r overflow-y-auto bg-muted/20">
          <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Slides
          </div>
          <ul>
            {slides.map((s) => {
              const editable = !!OVERRIDE_FIELDS[s.key]
              return (
                <li key={s.key}>
                  <button
                    onClick={() => setSelectedKey(s.key)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 border-l-2",
                      selectedKey === s.key
                        ? "bg-sky-50 border-sky-500 dark:bg-sky-950"
                        : "border-transparent hover:bg-muted/50"
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          s.visible ? "bg-sky-500" : "bg-neutral-300"
                        )}
                      />
                      <span
                        className={cn(
                          "truncate",
                          !s.visible && "text-muted-foreground line-through"
                        )}
                      >
                        {SLIDE_LABELS[s.key]}
                      </span>
                    </span>
                    {!editable && (
                      <Badge variant="outline" className="text-[9px] py-0 h-4">
                        em breve
                      </Badge>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <section className="overflow-y-auto p-6">
          {!selected ? (
            <p className="text-muted-foreground">Selecione um slide à esquerda.</p>
          ) : (
            <div className="space-y-5 max-w-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{SLIDE_LABELS[selected.key]}</h2>
                  <p className="text-xs text-muted-foreground">{selected.key}</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Label htmlFor="visible" className="text-muted-foreground">
                    Visível
                  </Label>
                  <Switch
                    id="visible"
                    checked={selected.visible}
                    onCheckedChange={() => toggleVisible(selected.key)}
                  />
                </div>
              </div>

              {fields ? (
                <>
                  {fields.map((f) => (
                    <div key={f.key} className="space-y-2">
                      <Label htmlFor={`${selected.key}-${f.key}`}>{f.label}</Label>
                      <Textarea
                        id={`${selected.key}-${f.key}`}
                        rows={5}
                        placeholder={f.placeholder}
                        value={selected.overrides[f.key] || ""}
                        onChange={(e) => setOverride(selected.key, f.key, e.target.value)}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Vazio = usa o texto padrão do template.
                      </p>
                    </div>
                  ))}
                  {Object.keys(selected.overrides).length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resetOverrides(selected.key)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> Restaurar padrão
                    </Button>
                  )}
                </>
              ) : (
                <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                  Este slide ainda não tem campos editáveis. Por enquanto você pode apenas
                  controlar a visibilidade.
                </div>
              )}
            </div>
          )}
        </section>

        <section className="border-l bg-neutral-100 dark:bg-neutral-900 overflow-hidden">
          <div className="px-4 py-2 border-b flex items-center justify-between bg-card">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Pré-visualização
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewVersion((v) => v + 1)}
              title="Atualizar"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
          <iframe
            key={previewVersion}
            src={`/print/owner-report/${id}`}
            title="Pré-visualização"
            className="w-full h-[calc(100%-2.5rem)] border-0 bg-white"
          />
        </section>
      </div>
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null
  if (state === "saving")
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
      </span>
    )
  if (state === "saved")
    return (
      <span className="text-xs text-emerald-600 flex items-center gap-1.5">
        <Check className="h-3 w-3" /> Salvo
      </span>
    )
  return <span className="text-xs text-destructive">Falha ao salvar</span>
}
