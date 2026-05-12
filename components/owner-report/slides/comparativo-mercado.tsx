import { SlideShell } from "@/components/owner-report/slide-shell"
import { BrandLogo } from "@/components/owner-report/brand-logo"
import { brand } from "@/components/owner-report/theme"

export interface ComparativoMercadoData {
  nomePropriedade: string
  periodoLabel: string
  basketName: string
  adrUnidade: number | null
  adrMedianaCesta: number | null
  adrP75Cesta: number | null
  ocupacaoUnidade: number | null
  ocupacaoEstimadaCesta: number | null
}

const brl = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })

const INTRO_DEFAULT =
  "Comparativo entre a unidade e a cesta de concorrentes diretos para o período. Os valores de mercado são calculados a partir das extrações de preço dos anúncios pares."

export function ComparativoMercadoSlide({
  data,
  pageNumber = 8,
  overrides,
}: {
  data: ComparativoMercadoData
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
          Comparativo de Mercado
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
        <p className="text-xs mt-1" style={{ color: brand.muted }}>
          Cesta: <span style={{ color: brand.inkSoft }}>{data.basketName}</span>
        </p>
      </div>

      <div className="mt-10 flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: brand.muted }}>
              <th className="text-left font-medium pb-3 text-[11px] uppercase tracking-[0.14em]">
                Indicador
              </th>
              <th className="text-right font-medium pb-3 text-[11px] uppercase tracking-[0.14em]">
                Sua unidade
              </th>
              <th className="text-right font-medium pb-3 text-[11px] uppercase tracking-[0.14em]">
                Mediana da cesta
              </th>
              <th className="text-right font-medium pb-3 text-[11px] uppercase tracking-[0.14em]">
                Top 25% da cesta
              </th>
            </tr>
          </thead>
          <tbody>
            <Row
              label="ADR (diária média)"
              valor={brl(data.adrUnidade)}
              mediana={brl(data.adrMedianaCesta)}
              top25={brl(data.adrP75Cesta)}
              destaque
            />
          </tbody>
        </table>

        <p className="mt-6 text-xs italic" style={{ color: brand.muted }}>
          ADR da cesta usa apenas dias com extrações válidas dos concorrentes.
        </p>
      </div>

      <footer
        className="mt-auto pt-6 flex items-center justify-between text-[11px]"
        style={{ color: brand.muted, borderTop: `1px solid ${brand.hairline}` }}
      >
        <span>Quarto à Vista · Fonte: PMS + airbnb_extrações</span>
        <span>{pageNumber}</span>
      </footer>
    </SlideShell>
  )
}

function Row({
  label,
  valor,
  mediana,
  top25,
  destaque,
}: {
  label: string
  valor: string
  mediana: string
  top25: string
  destaque?: boolean
}) {
  return (
    <tr style={{ borderTop: `1px solid ${brand.hairline}` }}>
      <td className="py-4" style={{ color: brand.ink }}>
        {label}
      </td>
      <td
        className="py-4 text-right tabular-nums font-semibold"
        style={{ color: destaque ? brand.primary : brand.ink, fontSize: 18 }}
      >
        {valor}
      </td>
      <td className="py-4 text-right tabular-nums" style={{ color: brand.inkSoft, fontSize: 18 }}>
        {mediana}
      </td>
      <td className="py-4 text-right tabular-nums" style={{ color: brand.inkSoft, fontSize: 18 }}>
        {top25}
      </td>
    </tr>
  )
}
