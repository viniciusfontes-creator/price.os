import { SlideShell } from "@/components/owner-report/slide-shell"
import { BrandLogo } from "@/components/owner-report/brand-logo"
import { brand } from "@/components/owner-report/theme"

export interface MixCanaisRow {
  canal: string
  receita: number
  reservas: number
  noites: number
  adr: number
  share: number
}

export interface MixCanaisData {
  nomePropriedade: string
  periodoLabel: string
  canais: MixCanaisRow[]
  totalReceita: number
}

const PALETTE = [
  brand.primary,
  "#0E86C7",
  "#0369A1",
  "#0EA5E9",
  "#7DD3FC",
  "#BAE6FD",
  brand.muted,
]

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })

const INTRO_DEFAULT =
  "Distribuição da receita por canal de venda no período, com participação relativa e ADR médio em cada canal."

export function MixCanaisSlide({
  data,
  pageNumber = 6,
  overrides,
}: {
  data: MixCanaisData
  pageNumber?: number
  overrides?: { intro?: string }
}) {
  const intro = overrides?.intro?.trim() || INTRO_DEFAULT
  const semDados = data.canais.length === 0 || data.totalReceita === 0
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
          Mix de Canais
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

      {semDados ? (
        <p className="mt-12 text-sm" style={{ color: brand.muted }}>
          Sem reservas neste período para calcular o mix.
        </p>
      ) : (
        <div className="mt-10 grid grid-cols-12 gap-10 items-start">
          <div className="col-span-4">
            <Donut canais={data.canais} />
            <div className="mt-6 space-y-2">
              {data.canais.map((c, idx) => (
                <div key={c.canal} className="flex items-center gap-2">
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      background: PALETTE[idx % PALETTE.length],
                      borderRadius: 2,
                      display: "inline-block",
                    }}
                  />
                  <span className="text-sm" style={{ color: brand.inkSoft }}>
                    {c.canal}
                  </span>
                  <span
                    className="ml-auto text-sm font-semibold tabular-nums"
                    style={{ color: brand.ink }}
                  >
                    {Math.round(c.share * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-8">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: brand.muted }}>
                  <th className="text-left font-medium pb-3 text-[11px] uppercase tracking-[0.14em]">
                    Canal
                  </th>
                  <th className="text-right font-medium pb-3 text-[11px] uppercase tracking-[0.14em]">
                    Reservas
                  </th>
                  <th className="text-right font-medium pb-3 text-[11px] uppercase tracking-[0.14em]">
                    Noites
                  </th>
                  <th className="text-right font-medium pb-3 text-[11px] uppercase tracking-[0.14em]">
                    ADR
                  </th>
                  <th className="text-right font-medium pb-3 text-[11px] uppercase tracking-[0.14em]">
                    Receita
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.canais.map((c) => (
                  <tr key={c.canal} style={{ borderTop: `1px solid ${brand.hairline}` }}>
                    <td className="py-2.5" style={{ color: brand.ink }}>
                      {c.canal}
                    </td>
                    <td className="py-2.5 text-right tabular-nums" style={{ color: brand.inkSoft }}>
                      {c.reservas}
                    </td>
                    <td className="py-2.5 text-right tabular-nums" style={{ color: brand.inkSoft }}>
                      {c.noites}
                    </td>
                    <td className="py-2.5 text-right tabular-nums" style={{ color: brand.inkSoft }}>
                      {brl(c.adr)}
                    </td>
                    <td
                      className="py-2.5 text-right tabular-nums font-semibold"
                      style={{ color: brand.ink }}
                    >
                      {brl(c.receita)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

function Donut({ canais }: { canais: MixCanaisRow[] }) {
  const size = 180
  const stroke = 24
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let acc = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={brand.hairline} strokeWidth={stroke} />
      {canais.map((slice, idx) => {
        const start = acc
        const len = slice.share * c
        acc += len
        return (
          <circle
            key={slice.canal}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={PALETTE[idx % PALETTE.length]}
            strokeWidth={stroke}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-start + c / 4}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )
      })}
    </svg>
  )
}
