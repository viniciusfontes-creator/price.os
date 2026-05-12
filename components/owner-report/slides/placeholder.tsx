import { SlideShell } from "@/components/owner-report/slide-shell"
import { BrandLogo } from "@/components/owner-report/brand-logo"
import { brand } from "@/components/owner-report/theme"

/**
 * Slide placeholder usado pra slides ainda não implementados (Tarifa × Mercado,
 * Comparativo de Mercado, Eventos & Sazonalidade). Renderiza um aviso explicativo
 * em vez de quebrar o PDF.
 */
export function PlaceholderSlide({
  titulo,
  motivo,
  pageNumber = 0,
}: {
  titulo: string
  motivo: string
  pageNumber?: number
}) {
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
        </div>
      </header>
      <div className="flex-1 flex items-center">
        <div className="max-w-2xl">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: brand.primary }}
          >
            Em construção
          </p>
          <h1
            className="font-semibold mt-3"
            style={{ color: brand.ink, fontSize: 40, letterSpacing: "-0.02em", lineHeight: 1.1 }}
          >
            {titulo}
          </h1>
          <p className="mt-5 text-base" style={{ color: brand.inkSoft }}>
            {motivo}
          </p>
        </div>
      </div>
      <footer
        className="pt-4 flex items-center justify-between text-[11px]"
        style={{ color: brand.muted, borderTop: `1px solid ${brand.hairline}` }}
      >
        <span>Quarto à Vista · Relatório gerado para o proprietário</span>
        <span>{pageNumber}</span>
      </footer>
    </SlideShell>
  )
}
