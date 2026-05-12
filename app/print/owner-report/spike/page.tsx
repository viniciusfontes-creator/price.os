import { ResumoExecutivoSlide } from "@/components/owner-report/slides/resumo-executivo"
import { buildOwnerReportPayload } from "@/lib/owner-report/service"
import { brand } from "@/components/owner-report/theme"

const MOCK = {
  nomePropriedade: "Apto Copacabana 502",
  periodoLabel: "Outubro / 2025",
  kpis: { receita: 24580, nReservas: 12, ocupacaoPct: 0.87, adr: 945, mediaHospedes: 2.4 },
}

export const dynamic = "force-dynamic"
export const revalidate = 0

interface SpikeProps {
  searchParams: { idprop?: string; ini?: string; fim?: string }
}

export default async function SpikePage({ searchParams }: SpikeProps) {
  const { idprop, ini, fim } = searchParams

  if (!idprop || !ini || !fim) {
    return <ResumoExecutivoSlide data={MOCK} />
  }

  const payload = await buildOwnerReportPayload(idprop, { ini, fim })

  if ("error" in payload) {
    return <ErrorSlide message={payload.error} idprop={idprop} ini={ini} fim={fim} />
  }

  return <ResumoExecutivoSlide data={payload.resumoExecutivo} />
}

function ErrorSlide({
  message,
  idprop,
  ini,
  fim,
}: {
  message: string
  idprop: string
  ini: string
  fim: string
}) {
  return (
    <div
      style={{
        width: 1123,
        height: 794,
        background: brand.sandSoft,
        color: brand.ink,
        padding: 56,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <h1 style={{ fontSize: 32, fontWeight: 600, color: brand.primary }}>
        Não foi possível gerar o relatório
      </h1>
      <p style={{ marginTop: 16, color: brand.inkSoft, fontSize: 16 }}>{message}</p>
      <pre
        style={{
          marginTop: 24,
          background: "#fff",
          border: `1px solid ${brand.hairline}`,
          padding: 16,
          fontSize: 13,
          color: brand.inkSoft,
          borderRadius: 8,
        }}
      >
        {JSON.stringify({ idprop, ini, fim }, null, 2)}
      </pre>
    </div>
  )
}
