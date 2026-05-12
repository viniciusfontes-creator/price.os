import { SlideShell } from "@/components/owner-report/slide-shell"
import { BrandLogo } from "@/components/owner-report/brand-logo"
import { brand } from "@/components/owner-report/theme"

export interface EventoItem {
  nome: string
  data: string
  impacto: "alto" | "médio" | "baixo"
}

export interface EventosSazonalidadeData {
  nomePropriedade: string
  periodoLabel: string
  praca: string
  eventos: EventoItem[]
}

const IMPACT_COLOR: Record<EventoItem["impacto"], { bg: string; fg: string; label: string }> = {
  alto: { bg: "#DCFCE7", fg: "#15803D", label: "Alto" },
  médio: { bg: "#FEF3C7", fg: "#B45309", label: "Médio" },
  baixo: { bg: "#F1F5F9", fg: "#64748B", label: "Baixo" },
}

const INTRO_DEFAULT =
  "Eventos e datas relevantes na região que influenciam a demanda no período. As classificações de impacto refletem a movimentação esperada de turistas."

export function EventosSazonalidadeSlide({
  data,
  pageNumber = 9,
  overrides,
}: {
  data: EventosSazonalidadeData
  pageNumber?: number
  overrides?: { intro?: string }
}) {
  const intro = overrides?.intro?.trim() || INTRO_DEFAULT
  return (
    <SlideShell>
      <header className="flex items-start justify-between">
        <BrandLogo height={40} />
        <div className="text-right">
          <p
            className="text-[11px] font-medium uppercase tracking-[0.18em]"
            style={{ color: brand.primary }}
          >
            Relatório do Proprietário
          </p>
          <p className="text-sm mt-1" style={{ color: brand.inkSoft }}>
            {data.periodoLabel}
          </p>
        </div>
      </header>

      <div className="mt-10">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: brand.primary }}
        >
          Eventos & Sazonalidade · {data.praca}
        </p>
        <h1
          className="text-[40px] font-semibold leading-tight mt-2"
          style={{ color: brand.ink, letterSpacing: "-0.02em" }}
        >
          {data.nomePropriedade}
        </h1>
        <p className="mt-3 text-base max-w-3xl whitespace-pre-line" style={{ color: brand.inkSoft }}>
          {intro}
        </p>
      </div>

      <div className="mt-8 flex-1">
        {data.eventos.length === 0 ? (
          <p className="text-sm" style={{ color: brand.muted }}>
            Não foram encontrados eventos relevantes para este período.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: brand.hairline }}>
            {data.eventos.map((e, idx) => {
              const c = IMPACT_COLOR[e.impacto]
              return (
                <li key={idx} className="py-3 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="font-semibold" style={{ color: brand.ink }}>
                      {e.nome}
                    </div>
                    {e.data && (
                      <div className="text-xs mt-0.5" style={{ color: brand.inkSoft }}>
                        {e.data}
                      </div>
                    )}
                  </div>
                  <span
                    className="text-[11px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 rounded-md"
                    style={{ background: c.bg, color: c.fg }}
                  >
                    Impacto {c.label}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <footer
        className="mt-auto pt-6 flex items-center justify-between text-[11px]"
        style={{ color: brand.muted, borderTop: `1px solid ${brand.hairline}` }}
      >
        <span>Quarto à Vista · Fonte: pesquisa web automatizada</span>
        <span>{pageNumber}</span>
      </footer>
    </SlideShell>
  )
}
