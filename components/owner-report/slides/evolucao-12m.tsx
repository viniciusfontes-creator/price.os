import { SlideShell } from "@/components/owner-report/slide-shell"
import { BrandLogo } from "@/components/owner-report/brand-logo"
import { brand } from "@/components/owner-report/theme"

export interface Evolucao12mMes {
  ano: number
  mes: number
  label: string
  labelLong: string
  realizado: number
  realizadoAnoAnt: number
  yoyPct: number | null
}

export interface Evolucao12mData {
  nomePropriedade: string
  periodoLabel: string
  total12m: number
  totalAnoAnterior: number
  deltaPct: number | null
  meses: Evolucao12mMes[]
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })

const INTRO_DEFAULT =
  "Receita mensal dos últimos doze meses, comparada com o mesmo mês do ano anterior. As barras claras representam o ano anterior."

export function Evolucao12mSlide({
  data,
  pageNumber = 4,
  overrides,
}: {
  data: Evolucao12mData
  pageNumber?: number
  overrides?: { intro?: string }
}) {
  const intro = overrides?.intro?.trim() || INTRO_DEFAULT
  const maxValor = Math.max(
    1,
    ...data.meses.flatMap((m) => [m.realizado, m.realizadoAnoAnt])
  )
  const semYoY = data.totalAnoAnterior <= 0
  const deltaSign = data.deltaPct == null ? 0 : Math.sign(data.deltaPct)
  const deltaColor = deltaSign > 0 ? "#15803D" : deltaSign < 0 ? "#B91C1C" : brand.inkSoft

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
          Evolução de Receita · últimos 12 meses
        </p>
        <h1
          className="text-[40px] font-semibold leading-tight mt-2"
          style={{ color: brand.ink, letterSpacing: "-0.02em" }}
        >
          {data.nomePropriedade}
        </h1>
        <p
          className="mt-3 text-base max-w-3xl whitespace-pre-line"
          style={{ color: brand.inkSoft }}
        >
          {intro}
        </p>
      </div>

      <div className="mt-8 grid grid-cols-12 gap-8 items-end">
        <div className="col-span-4 space-y-5">
          <KpiRow label="Receita 12m" value={brl(data.total12m)} large />
          <KpiRow
            label="12m anteriores"
            value={brl(data.totalAnoAnterior)}
            mutedValue
          />
          {!semYoY && data.deltaPct != null && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: brand.muted }}>
                Variação YoY
              </p>
              <div
                className="font-semibold tabular-nums mt-1"
                style={{ color: deltaColor, fontSize: 32, letterSpacing: "-0.02em", lineHeight: 1 }}
              >
                {data.deltaPct > 0 ? "+" : ""}
                {(data.deltaPct * 100).toFixed(1)}%
              </div>
            </div>
          )}
        </div>

        <div className="col-span-8">
          <div className="flex items-stretch gap-2 h-[260px]">
            {data.meses.map((m) => (
              <BarPair key={`${m.ano}-${m.mes}`} m={m} max={maxValor} />
            ))}
          </div>
          <Legend />
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

function KpiRow({
  label,
  value,
  large,
  mutedValue,
}: {
  label: string
  value: string
  large?: boolean
  mutedValue?: boolean
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: brand.muted }}>
        {label}
      </p>
      <div
        className="font-semibold tabular-nums mt-1"
        style={{
          color: mutedValue ? brand.inkSoft : brand.ink,
          fontSize: large ? 36 : 22,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function BarPair({ m, max }: { m: Evolucao12mMes; max: number }) {
  const hCur = Math.max(1, (m.realizado / max) * 100)
  const hPrev = m.realizadoAnoAnt > 0 ? Math.max(1, (m.realizadoAnoAnt / max) * 100) : 0
  const yoyLabel =
    m.yoyPct == null
      ? "—"
      : `${m.yoyPct >= 0 ? "+" : ""}${Math.round(m.yoyPct * 100)}%`
  const yoyColor = m.yoyPct == null ? brand.muted : m.yoyPct >= 0 ? "#15803D" : "#B91C1C"
  return (
    <div className="flex-1 flex flex-col items-center h-full">
      {/* % YoY no topo */}
      <div
        className="text-[10px] tabular-nums font-semibold leading-none mb-1.5 h-3"
        style={{ color: yoyColor }}
      >
        {yoyLabel}
      </div>
      <div className="w-full flex items-end justify-center gap-[3px] flex-1">
        {/* Ano anterior (ghost) */}
        <div
          style={{
            width: 8,
            height: `${hPrev}%`,
            background: "transparent",
            border: `1.5px solid ${brand.hairline}`,
            borderRadius: 2,
          }}
        />
        {/* Atual */}
        <div
          style={{
            width: 10,
            height: `${hCur}%`,
            background: brand.primary,
            borderRadius: 2,
          }}
        />
      </div>
      <div className="text-[10px] mt-1.5" style={{ color: brand.inkSoft }}>
        {m.label}
      </div>
    </div>
  )
}

function Legend() {
  return (
    <div className="mt-4 flex items-center gap-5 text-[11px]" style={{ color: brand.inkSoft }}>
      <span className="inline-flex items-center gap-1.5">
        <span
          style={{ width: 10, height: 10, background: brand.primary, borderRadius: 2, display: "inline-block" }}
        />
        Atual
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          style={{
            width: 10,
            height: 10,
            background: "transparent",
            border: `1.5px solid ${brand.hairline}`,
            borderRadius: 2,
            display: "inline-block",
          }}
        />
        Ano anterior
      </span>
    </div>
  )
}
