import { SlideShell } from "@/components/owner-report/slide-shell"
import { BrandLogo } from "@/components/owner-report/brand-logo"
import { brand } from "@/components/owner-report/theme"

export interface ResumoExecutivoData {
  nomePropriedade: string
  periodoLabel: string
  kpis: {
    receita: number
    nReservas: number
    ocupacaoPct: number
    adr: number
    mediaHospedes: number
  }
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
const pct = (n: number) => `${Math.round(n * 100)}%`

const INTRO_DEFAULT =
  "Visão consolidada da performance do período. Os indicadores abaixo refletem todas as reservas confirmadas no intervalo selecionado."

export function ResumoExecutivoSlide({
  data,
  pageNumber = 1,
  overrides,
}: {
  data: ResumoExecutivoData
  pageNumber?: number
  overrides?: { intro?: string }
}) {
  const { nomePropriedade, periodoLabel, kpis } = data
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
            {periodoLabel}
          </p>
        </div>
      </header>

      <div className="mt-12">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: brand.primary }}
        >
          Resumo Executivo
        </p>
        <h1
          className="text-[44px] font-semibold leading-tight mt-2"
          style={{ color: brand.ink, letterSpacing: "-0.02em" }}
        >
          {nomePropriedade}
        </h1>
        <p className="mt-3 text-base max-w-2xl whitespace-pre-line" style={{ color: brand.inkSoft }}>
          {intro}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-5 mt-10">
        <Kpi label="Receita" value={brl(kpis.receita)} sub={`${kpis.nReservas} reservas`} accent />
        <Kpi label="Ocupação" value={pct(kpis.ocupacaoPct)} sub="Noites vendidas" />
        <Kpi label="ADR" value={brl(kpis.adr)} sub="Diária média" />
        <Kpi
          label="Média de hóspedes"
          value={kpis.mediaHospedes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
          sub="Por reserva"
        />
      </div>

      <footer
        className="mt-auto pt-8 flex items-center justify-between text-[11px]"
        style={{ color: brand.muted, borderTop: `1px solid ${brand.hairline}` }}
      >
        <span>Quarto à Vista · Relatório gerado para o proprietário</span>
        <span>{pageNumber}</span>
      </footer>
    </SlideShell>
  )
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  const bg = accent ? brand.primarySoft : "#FFFFFF"
  const border = accent ? brand.primarySoft : brand.hairline
  const labelColor = accent ? brand.primaryDark : brand.inkSoft
  return (
    <div
      className="rounded-xl px-6 py-5"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: labelColor }}
      >
        {label}
      </div>
      <div
        className="text-[34px] font-semibold tabular-nums mt-3 leading-none"
        style={{ color: brand.ink, letterSpacing: "-0.02em" }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-xs mt-2" style={{ color: brand.muted }}>
          {sub}
        </div>
      )}
    </div>
  )
}
