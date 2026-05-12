import { SlideShell } from "@/components/owner-report/slide-shell"
import { BrandLogo } from "@/components/owner-report/brand-logo"
import { brand } from "@/components/owner-report/theme"

export interface AssinaturaData {
  nomePropriedade: string
  periodoLabel: string
  autorEmail: string
  geradoEm: string // ISO
}

export function AssinaturaSlide({
  data,
  pageNumber = 11,
  overrides,
}: {
  data: AssinaturaData
  pageNumber?: number
  overrides?: { mensagem?: string; disclaimer?: string }
}) {
  const mensagem =
    overrides?.mensagem?.trim() ||
    "Este relatório foi preparado pela equipe Quarto à Vista para acompanhamento da performance da sua unidade."
  const disclaimer =
    overrides?.disclaimer?.trim() ||
    "Os dados refletem reservas confirmadas no PMS até a data de geração. Cancelamentos e ajustes posteriores podem alterar os números."
  const gerado = new Date(data.geradoEm)
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
        <div className="max-w-2xl">
          <p
            className="text-[12px] font-semibold uppercase tracking-[0.3em]"
            style={{ color: brand.primary }}
          >
            Obrigado
          </p>
          <h1
            className="font-semibold mt-4"
            style={{ color: brand.ink, fontSize: 56, letterSpacing: "-0.03em", lineHeight: 1.05 }}
          >
            {data.nomePropriedade}
          </h1>
          <p
            className="mt-5 text-lg whitespace-pre-line max-w-xl"
            style={{ color: brand.inkSoft }}
          >
            {mensagem}
          </p>
          <div className="mt-10 grid grid-cols-2 gap-6 max-w-lg">
            <Field label="Preparado por" value={data.autorEmail} />
            <Field
              label="Gerado em"
              value={gerado.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            />
          </div>
        </div>
      </div>

      <footer
        className="pt-6 flex items-center justify-between text-[11px]"
        style={{ color: brand.muted, borderTop: `1px solid ${brand.hairline}` }}
      >
        <span className="max-w-2xl italic">{disclaimer}</span>
        <span>{pageNumber}</span>
      </footer>
    </SlideShell>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: brand.muted }}>
        {label}
      </p>
      <p className="text-sm mt-1 font-medium" style={{ color: brand.ink }}>
        {value}
      </p>
    </div>
  )
}
