import { SlideShell } from "@/components/owner-report/slide-shell"
import { BrandLogo } from "@/components/owner-report/brand-logo"
import { brand } from "@/components/owner-report/theme"

export interface PerformanceMetaMes {
  mes: number
  label: string
  realizado: number
  meta: number
  pct: number
  futuro: boolean
}

export interface PerformanceMetaData {
  ano: number
  nomePropriedade: string
  periodoLabel: string
  realizadoYtd: number
  metaYtd: number
  pctYtd: number
  status: "A" | "B" | "C" | "D" | "E"
  meses: PerformanceMetaMes[]
}

const STATUS_COLORS: Record<PerformanceMetaData["status"], { bg: string; fg: string }> = {
  A: { bg: "#DCFCE7", fg: "#15803D" },
  B: { bg: "#E0F2FE", fg: "#0369A1" },
  C: { bg: "#FEF3C7", fg: "#B45309" },
  D: { bg: "#FFEDD5", fg: "#C2410C" },
  E: { bg: "#FEE2E2", fg: "#B91C1C" },
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })

const NOTE_DEFAULT =
  "O acompanhamento da meta considera as receitas com checkout dentro de cada mês. Meses futuros aparecem em cinza por ainda não terem dados consolidados."

export function PerformanceMetaSlide({
  data,
  pageNumber = 3,
  overrides,
}: {
  data: PerformanceMetaData
  pageNumber?: number
  overrides?: { intro?: string; nota?: string }
}) {
  const colors = STATUS_COLORS[data.status]
  const nota = overrides?.nota?.trim() || NOTE_DEFAULT
  const semMeta = data.metaYtd <= 0
  const introDefault = semMeta
    ? `Nenhuma meta cadastrada para ${data.ano}. Exibimos abaixo apenas o realizado.`
    : `No acumulado de ${data.ano}, a unidade realizou ${brl(data.realizadoYtd)} dos ${brl(data.metaYtd)} previstos em metas até o momento.`
  const intro = overrides?.intro?.trim() || introDefault

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
          Performance {data.ano}
        </p>
        <div className="flex items-baseline gap-4 mt-2">
          <h1
            className="text-[40px] font-semibold leading-tight"
            style={{ color: brand.ink, letterSpacing: "-0.02em" }}
          >
            {data.nomePropriedade}
          </h1>
          {!semMeta && (
            <span
              className="px-3 py-1 rounded-md text-sm font-semibold"
              style={{ background: colors.bg, color: colors.fg }}
            >
              Status {data.status}
            </span>
          )}
        </div>
        <p className="mt-3 text-base max-w-3xl whitespace-pre-line" style={{ color: brand.inkSoft }}>
          {intro}
        </p>
      </div>

      <div className="mt-10 grid grid-cols-12 gap-8 items-baseline">
        <div className="col-span-5">
          <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: brand.muted }}>
            Realizado no ano
          </p>
          <div
            className="font-semibold tabular-nums mt-1"
            style={{ color: brand.ink, fontSize: 56, letterSpacing: "-0.03em", lineHeight: 1 }}
          >
            {brl(data.realizadoYtd)}
          </div>
          {!semMeta && (
            <p className="mt-2 text-sm" style={{ color: brand.inkSoft }}>
              de {brl(data.metaYtd)} em metas{" "}
              <span style={{ color: brand.primary, fontWeight: 600 }}>
                · {Math.round(data.pctYtd * 100)}% atingido
              </span>
            </p>
          )}
        </div>
        <div className="col-span-7">
          <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: brand.muted }}>
            Acumulado mês a mês
          </p>
          <div className="mt-3 flex items-stretch gap-2 h-[160px]">
            {data.meses.map((m) => (
              <MonthCell key={m.mes} m={m} />
            ))}
          </div>
        </div>
      </div>

      <p className="mt-auto pt-6 text-xs italic max-w-3xl" style={{ color: brand.muted }}>
        {nota}
      </p>

      <footer
        className="pt-4 mt-3 flex items-center justify-between text-[11px]"
        style={{ color: brand.muted, borderTop: `1px solid ${brand.hairline}` }}
      >
        <span>Quarto à Vista · Relatório gerado para o proprietário</span>
        <span>{pageNumber}</span>
      </footer>
    </SlideShell>
  )
}

function MonthCell({ m }: { m: PerformanceMetaMes }) {
  const semMeta = m.meta <= 0
  // Cap visual em 100% (excedente não cresce mais que a "track")
  const heightPct = semMeta ? 0 : Math.min(1, m.pct)
  const fillH = Math.max(2, heightPct * 100)
  const isPast = !m.futuro && !semMeta
  // Atingiu 100%+ → azul escuro (celebra). Senão → azul claro. Futuro/sem meta → cinza claro.
  const barColor = m.futuro
    ? brand.hairline
    : semMeta
      ? brand.hairline
      : m.pct >= 1
        ? brand.primaryDark
        : brand.primary
  const pctLabel = semMeta ? "—" : `${Math.round(m.pct * 100)}%`
  const showLabel = isPast
  return (
    <div className="flex-1 flex flex-col items-center h-full">
      {/* Label de % no topo */}
      <div
        className="text-[11px] tabular-nums font-semibold leading-none mb-1.5 h-3"
        style={{ color: showLabel ? brand.ink : brand.muted, opacity: showLabel ? 1 : 0 }}
      >
        {showLabel ? pctLabel : ""}
      </div>
      <div
        className="w-full rounded-sm relative flex-1"
        style={{ background: brand.hairline, opacity: m.futuro ? 0.4 : 1 }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: `${m.futuro ? 0 : fillH}%`,
            background: barColor,
            borderRadius: 2,
          }}
        />
      </div>
      <div
        className="text-[10px] mt-1.5"
        style={{
          color: m.futuro ? brand.muted : brand.inkSoft,
          fontWeight: isPast ? 500 : 400,
        }}
      >
        {m.label}
      </div>
    </div>
  )
}
