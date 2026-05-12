import { SlideShell } from "@/components/owner-report/slide-shell"
import { BrandLogo } from "@/components/owner-report/brand-logo"
import { brand } from "@/components/owner-report/theme"

export interface CapaData {
  nomePropriedade: string
  praca: string
  grupo: string
  subGrupo: string | null
  periodoLabel: string
}

export function CapaSlide({
  data,
  overrides,
}: {
  data: CapaData
  pageNumber?: number
  overrides?: { destaque?: string }
}) {
  const destaque =
    overrides?.destaque?.trim() ||
    "Um panorama completo da performance da sua unidade no período."

  return (
    <SlideShell bg={brand.primarySoft}>
      <header className="flex items-start justify-between">
        <BrandLogo height={44} />
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

      <div className="flex-1 flex items-center">
        <div className="max-w-3xl">
          <p
            className="text-[12px] font-semibold uppercase tracking-[0.3em]"
            style={{ color: brand.primary }}
          >
            {data.praca || data.grupo || "Quarto à Vista"}
          </p>
          <h1
            className="font-semibold mt-4"
            style={{
              color: brand.ink,
              fontSize: 72,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            {data.nomePropriedade}
          </h1>
          <p
            className="mt-6 text-xl max-w-2xl whitespace-pre-line"
            style={{ color: brand.inkSoft }}
          >
            {destaque}
          </p>
        </div>
      </div>

      <footer
        className="pt-6 flex items-end justify-between text-[11px]"
        style={{ color: brand.muted, borderTop: `1px solid ${brand.hairline}` }}
      >
        <span>
          Período de referência ·{" "}
          <span style={{ color: brand.inkSoft, fontWeight: 500 }}>{data.periodoLabel}</span>
        </span>
        <span style={{ color: brand.muted }}>quartoavista.com.br</span>
      </footer>
    </SlideShell>
  )
}
