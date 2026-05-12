import { SlideShell } from "@/components/owner-report/slide-shell"
import { BrandLogo } from "@/components/owner-report/brand-logo"
import { brand } from "@/components/owner-report/theme"

export interface TarifaMercadoPonto {
  date: string
  praticada: number | null
  baseTarifario: number | null
  medianaMercado: number | null
}

export interface TarifaMercadoData {
  nomePropriedade: string
  periodoLabel: string
  basketName: string
  serie: TarifaMercadoPonto[]
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })

const INTRO_DEFAULT =
  "Tarifa praticada pela unidade ao longo do período comparada com a mediana dos concorrentes diretos cadastrados."

export function TarifaMercadoSlide({
  data,
  pageNumber = 7,
  overrides,
}: {
  data: TarifaMercadoData
  pageNumber?: number
  overrides?: { intro?: string }
}) {
  const intro = overrides?.intro?.trim() || INTRO_DEFAULT
  // Removida a série "Base do tarifário" — confundia o proprietário com
  // detalhe operacional interno. Mostra só praticada × mercado.
  const allVals = data.serie.flatMap((p) =>
    [p.praticada, p.medianaMercado].filter((v): v is number => v != null)
  )
  const rawMax = Math.max(1, ...allVals)
  const rawMin = Math.min(...allVals)
  // Escala com headroom (10% acima do max) e piso ancorado em um valor "limpo"
  const maxY = Math.ceil((rawMax * 1.1) / 100) * 100
  const minY = Math.max(0, Math.floor((rawMin * 0.85) / 100) * 100)
  const midY = (maxY + minY) / 2
  const W = 760
  const H = 280
  const padX = 70
  const padY = 24
  const innerW = W - padX * 2
  const innerH = H - padY * 2

  const xFor = (i: number) =>
    padX + (data.serie.length === 1 ? innerW / 2 : (i / (data.serie.length - 1)) * innerW)
  const yFor = (v: number) =>
    padY + innerH - ((v - minY) / Math.max(1, maxY - minY)) * innerH

  function pathFor(key: keyof TarifaMercadoPonto): string {
    let started = false
    let d = ""
    data.serie.forEach((p, i) => {
      const v = p[key] as number | null
      if (v == null) {
        started = false
        return
      }
      const x = xFor(i)
      const y = yFor(v)
      d += `${started ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `
      started = true
    })
    return d.trim()
  }

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
          Tarifa praticada vs. Mercado
        </p>
        <h1
          className="text-[36px] font-semibold leading-tight mt-2"
          style={{ color: brand.ink, letterSpacing: "-0.02em" }}
        >
          {data.nomePropriedade}
        </h1>
        <p className="mt-3 text-base max-w-3xl whitespace-pre-line" style={{ color: brand.inkSoft }}>
          {intro}
        </p>
        <p className="text-xs mt-1" style={{ color: brand.muted }}>
          Cesta de concorrentes: <span style={{ color: brand.inkSoft }}>{data.basketName}</span>
        </p>
      </div>

      <div className="mt-6 flex-1 flex items-center">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="max-w-full">
          <line
            x1={padX}
            y1={padY + innerH}
            x2={padX + innerW}
            y2={padY + innerH}
            stroke={brand.hairline}
          />
          <line x1={padX} y1={padY} x2={padX} y2={padY + innerH} stroke={brand.hairline} />
          {/* Gridlines */}
          <line
            x1={padX}
            y1={padY + innerH / 2}
            x2={padX + innerW}
            y2={padY + innerH / 2}
            stroke={brand.hairline}
            strokeDasharray="2 4"
          />
          <path
            d={pathFor("medianaMercado")}
            fill="none"
            stroke={brand.muted}
            strokeWidth={2}
            strokeDasharray="4 4"
          />
          <path d={pathFor("praticada")} fill="none" stroke={brand.primary} strokeWidth={3} />
          {/* Y axis labels: max, mid, min */}
          <text x={padX - 8} y={padY + 5} fontSize={11} fill={brand.muted} textAnchor="end">
            {brl(maxY)}
          </text>
          <text
            x={padX - 8}
            y={padY + innerH / 2 + 4}
            fontSize={11}
            fill={brand.muted}
            textAnchor="end"
          >
            {brl(midY)}
          </text>
          <text x={padX - 8} y={padY + innerH + 4} fontSize={11} fill={brand.muted} textAnchor="end">
            {brl(minY)}
          </text>
          {/* X axis labels */}
          {data.serie.length > 0 && (
            <>
              <text x={padX} y={H - 4} fontSize={10} fill={brand.muted}>
                {data.serie[0].date.slice(8, 10)}/{data.serie[0].date.slice(5, 7)}
              </text>
              <text x={padX + innerW} y={H - 4} fontSize={10} fill={brand.muted} textAnchor="end">
                {data.serie[data.serie.length - 1].date.slice(8, 10)}/{data.serie[data.serie.length - 1].date.slice(5, 7)}
              </text>
            </>
          )}
        </svg>

        <div className="ml-8 space-y-3 text-xs" style={{ color: brand.inkSoft }}>
          <Legenda color={brand.primary} label="Tarifa praticada" thickness={3} />
          <Legenda color={brand.muted} label="Mediana de mercado" thickness={2} dashed />
        </div>
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

function Legenda({
  color,
  opacity,
  label,
  thickness,
  dashed,
}: {
  color: string
  opacity?: number
  label: string
  thickness: number
  dashed?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <svg width={24} height={6}>
        <line
          x1={0}
          y1={3}
          x2={24}
          y2={3}
          stroke={color}
          strokeWidth={thickness}
          strokeOpacity={opacity ?? 1}
          strokeDasharray={dashed ? "3 3" : undefined}
        />
      </svg>
      <span>{label}</span>
    </div>
  )
}
