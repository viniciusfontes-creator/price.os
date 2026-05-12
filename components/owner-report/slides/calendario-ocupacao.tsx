import { SlideShell } from "@/components/owner-report/slide-shell"
import { BrandLogo } from "@/components/owner-report/brand-logo"
import { brand } from "@/components/owner-report/theme"

export interface CalendarioDia {
  date: string // YYYY-MM-DD
  status: "ocupada" | "bloqueada" | "manutencao" | "vaga"
}

export interface CalendarioOcupacaoData {
  nomePropriedade: string
  periodoLabel: string
  dias: CalendarioDia[]
  ocupadas: number
  bloqueadas: number
  vagas: number
  ocupacaoPct: number
}

const STATUS_COLOR: Record<CalendarioDia["status"], string> = {
  ocupada: brand.primary,
  bloqueada: brand.muted,
  // Manutenção é visualmente tratada como bloqueio (do ponto de vista do
  // proprietário, é dia indisponível pra venda). Mesmo cinza pra evitar
  // categorias visuais demais.
  manutencao: brand.muted,
  vaga: "#FEE2E2",
}

const INTRO_DEFAULT =
  "Cada quadrado representa um dia do período. Os dias em azul foram ocupados por hóspedes; em cinza estão bloqueios (proprietário ou manutenção); em vermelho claro, vagos."

export function CalendarioOcupacaoSlide({
  data,
  pageNumber = 5,
  overrides,
}: {
  data: CalendarioOcupacaoData
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
          Calendário de Ocupação
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

      <div className="mt-8 grid grid-cols-12 gap-10 flex-1">
        <div className="col-span-4 space-y-5">
          <KpiBlock label="Ocupação" value={`${Math.round(data.ocupacaoPct * 100)}%`} large />
          <Mini label="Ocupadas" value={data.ocupadas} color={STATUS_COLOR.ocupada} />
          <Mini label="Bloqueadas" value={data.bloqueadas} color={STATUS_COLOR.bloqueada} />
          <Mini label="Vagas" value={data.vagas} color={STATUS_COLOR.vaga} />
        </div>
        <div className="col-span-8 max-w-[480px]">
          <CalendarGrid dias={data.dias} />
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

function KpiBlock({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: brand.muted }}>
        {label}
      </p>
      <div
        className="font-semibold tabular-nums mt-1"
        style={{ color: brand.ink, fontSize: large ? 48 : 24, letterSpacing: "-0.02em", lineHeight: 1 }}
      >
        {value}
      </div>
    </div>
  )
}

function Mini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ width: 10, height: 10, background: color, borderRadius: 2, display: "inline-block" }} />
      <span className="text-xs" style={{ color: brand.inkSoft }}>
        {label}
      </span>
      <span className="ml-auto text-sm font-semibold tabular-nums" style={{ color: brand.ink }}>
        {value}
      </span>
    </div>
  )
}

function CalendarGrid({ dias }: { dias: CalendarioDia[] }) {
  if (dias.length === 0) return <p style={{ color: brand.muted }}>Sem dados.</p>
  // Agrupa por semana ISO (segunda como início) para evitar quebra grande
  // Aqui vamos só plotar 7 colunas e quantas linhas precisar.
  const first = new Date(dias[0].date + "T00:00:00Z")
  const firstDow = (first.getUTCDay() + 6) % 7 // 0=segunda
  const cells: Array<CalendarioDia | null> = Array(firstDow).fill(null).concat(dias)
  const weeks = Math.ceil(cells.length / 7)
  while (cells.length < weeks * 7) cells.push(null)

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-[9px] mb-1.5" style={{ color: brand.muted }}>
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c)
            return (
              <div key={i} style={{ aspectRatio: "1", background: "transparent" }} />
            )
          const day = parseInt(c.date.slice(8, 10), 10)
          return (
            <div
              key={i}
              style={{
                aspectRatio: "1",
                background: STATUS_COLOR[c.status],
                borderRadius: 3,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "flex-end",
                padding: 2,
              }}
            >
              <span
                className="text-[9px] font-medium"
                style={{
                  color:
                    c.status === "ocupada" || c.status === "bloqueada" || c.status === "manutencao"
                      ? "#fff"
                      : brand.ink,
                }}
              >
                {day}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
