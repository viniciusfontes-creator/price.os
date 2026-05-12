import { ResumoExecutivoSlide } from "./slides/resumo-executivo"
import { PerformanceMetaSlide } from "./slides/performance-meta"
import { Evolucao12mSlide } from "./slides/evolucao-12m"
import { CapaSlide } from "./slides/capa"
import { CalendarioOcupacaoSlide } from "./slides/calendario-ocupacao"
import { MixCanaisSlide } from "./slides/mix-canais"
import { ConclusaoSlide } from "./slides/conclusao"
import { AssinaturaSlide } from "./slides/assinatura"
import { PlaceholderSlide } from "./slides/placeholder"
import { TarifaMercadoSlide } from "./slides/tarifa-mercado"
import { ComparativoMercadoSlide } from "./slides/comparativo-mercado"
import { EventosSazonalidadeSlide } from "./slides/eventos-sazonalidade"
import type { SlideConfig, SlideKey } from "@/lib/owner-report/templates"

interface RendererProps {
  slides: SlideConfig[]
  snapshot: any
}

/**
 * Renderiza a sequência de slides visíveis aplicando page-break entre eles
 * (exceto após o último, pra evitar página em branco no PDF).
 */
export function SlideRenderer({ slides, snapshot }: RendererProps) {
  const visible = slides.filter((s) => s.visible)
  const last = visible.length - 1

  // Layout: stack vertical sem padding/margin. Puppeteer com width/height fixos
  // pagina naturalmente a cada 794px do documento.
  return (
    <div style={{ display: "block", margin: 0, padding: 0 }}>
      <style>{`
        @page { size: 1123px 794px; margin: 0; }
        html, body { margin: 0 !important; padding: 0 !important; background: transparent !important; }
        .print-root, .print-root > div { margin: 0 !important; padding: 0 !important; }
        .owner-slide { width: 1123px; height: 794px; overflow: hidden; page-break-after: always; break-after: page; }
        .owner-slide:last-of-type { page-break-after: auto; break-after: auto; }
      `}</style>
      {visible.map((cfg, idx) => {
        const node = renderOne(cfg, snapshot, idx + 1)
        if (!node) return null
        return (
          <div key={cfg.key + idx} className="owner-slide">
            {node}
          </div>
        )
      })}
    </div>
  )
}

function renderOne(cfg: SlideConfig, snapshot: any, pageNumber: number) {
  const key = cfg.key as SlideKey
  const o = cfg.overrides as any
  switch (key) {
    case "capa":
      if (!snapshot?.capa) return null
      return <CapaSlide data={snapshot.capa} overrides={o} pageNumber={pageNumber} />
    case "resumo_executivo":
      if (!snapshot?.resumoExecutivo) return null
      return <ResumoExecutivoSlide data={snapshot.resumoExecutivo} overrides={o} pageNumber={pageNumber} />
    case "performance_meta":
      if (!snapshot?.performanceMeta) return null
      return <PerformanceMetaSlide data={snapshot.performanceMeta} overrides={o} pageNumber={pageNumber} />
    case "evolucao_12m":
      if (!snapshot?.evolucao12m) return null
      return <Evolucao12mSlide data={snapshot.evolucao12m} overrides={o} pageNumber={pageNumber} />
    case "calendario_ocupacao":
      if (!snapshot?.calendarioOcupacao) return null
      return (
        <CalendarioOcupacaoSlide
          data={snapshot.calendarioOcupacao}
          overrides={o}
          pageNumber={pageNumber}
        />
      )
    case "mix_canais":
      if (!snapshot?.mixCanais) return null
      return <MixCanaisSlide data={snapshot.mixCanais} overrides={o} pageNumber={pageNumber} />
    case "tarifa_mercado":
      if (!snapshot?.tarifaMercado)
        return (
          <PlaceholderSlide
            titulo="Tarifa praticada vs. Mercado"
            motivo="Disponível quando a cesta de concorrentes da unidade estiver configurada no Market Monitor."
            pageNumber={pageNumber}
          />
        )
      return (
        <TarifaMercadoSlide data={snapshot.tarifaMercado} overrides={o} pageNumber={pageNumber} />
      )
    case "comparativo_mercado":
      if (!snapshot?.comparativoMercado)
        return (
          <PlaceholderSlide
            titulo="Comparativo de Mercado"
            motivo="Disponível quando a cesta de concorrentes da unidade estiver configurada no Market Monitor."
            pageNumber={pageNumber}
          />
        )
      return (
        <ComparativoMercadoSlide
          data={snapshot.comparativoMercado}
          overrides={o}
          pageNumber={pageNumber}
        />
      )
    case "eventos_sazonalidade":
      if (!snapshot?.eventosSazonalidade)
        return (
          <PlaceholderSlide
            titulo="Eventos & Sazonalidade"
            motivo="Sem dados de eventos para o período (a busca pode ter falhado ou não ter retornado eventos relevantes)."
            pageNumber={pageNumber}
          />
        )
      return (
        <EventosSazonalidadeSlide
          data={snapshot.eventosSazonalidade}
          overrides={o}
          pageNumber={pageNumber}
        />
      )
    case "conclusao_proximos_passos":
      if (!snapshot?.conclusao) return null
      return <ConclusaoSlide data={snapshot.conclusao} overrides={o} pageNumber={pageNumber} />
    case "assinatura":
      if (!snapshot?.assinatura) return null
      return <AssinaturaSlide data={snapshot.assinatura} overrides={o} pageNumber={pageNumber} />
    default:
      return null
  }
}
