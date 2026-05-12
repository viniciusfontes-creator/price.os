import { SlideShell } from "@/components/owner-report/slide-shell"
import { BrandLogo } from "@/components/owner-report/brand-logo"
import { brand } from "@/components/owner-report/theme"

export interface ConclusaoData {
  nomePropriedade: string
  periodoLabel: string
  paragrafos: string[]
  proximosPassos: string[]
}

export function ConclusaoSlide({
  data,
  pageNumber = 10,
  overrides,
}: {
  data: ConclusaoData
  pageNumber?: number
  overrides?: {
    paragrafo1?: string
    paragrafo2?: string
    proximo1?: string
    proximo2?: string
    proximo3?: string
  }
}) {
  const p1 = overrides?.paragrafo1?.trim() || data.paragrafos[0] || ""
  const p2 = overrides?.paragrafo2?.trim() || data.paragrafos[1] || ""
  const passos = [
    overrides?.proximo1?.trim() || data.proximosPassos[0],
    overrides?.proximo2?.trim() || data.proximosPassos[1],
    overrides?.proximo3?.trim() || data.proximosPassos[2],
  ].filter(Boolean) as string[]

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
          Conclusão e Próximos Passos
        </p>
        <h1
          className="text-[40px] font-semibold leading-tight mt-2"
          style={{ color: brand.ink, letterSpacing: "-0.02em" }}
        >
          {data.nomePropriedade}
        </h1>
      </div>

      <div className="mt-8 grid grid-cols-12 gap-10 flex-1">
        <div className="col-span-7 space-y-5">
          {p1 && (
            <p className="text-base whitespace-pre-line" style={{ color: brand.inkSoft }}>
              {p1}
            </p>
          )}
          {p2 && (
            <p className="text-base whitespace-pre-line" style={{ color: brand.inkSoft }}>
              {p2}
            </p>
          )}
        </div>

        <div className="col-span-5">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: brand.primary }}
          >
            Próximos passos
          </p>
          <ol className="mt-4 space-y-3">
            {passos.map((passo, idx) => (
              <li key={idx} className="flex gap-3">
                <span
                  className="shrink-0 w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center"
                  style={{ background: brand.primarySoft, color: brand.primaryDark }}
                >
                  {idx + 1}
                </span>
                <span className="text-sm whitespace-pre-line" style={{ color: brand.ink }}>
                  {passo}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <footer
        className="mt-auto pt-6 flex items-center justify-between text-[11px]"
        style={{ color: brand.muted, borderTop: `1px solid ${brand.hairline}` }}
      >
        <span>Quarto à Vista · Relatório gerado para o proprietário</span>
        <span>{pageNumber}</span>
      </footer>
    </SlideShell>
  )
}
