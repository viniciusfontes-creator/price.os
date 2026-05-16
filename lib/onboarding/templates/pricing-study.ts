/**
 * Template HTML do "Estudo de Rentabilidade" (porte 1:1 do node HTML do
 * workflow n8n [Onboarding] Precificação e Estudo de Rentabilidade).
 *
 * Stack: HTML + CSS inline (sem React), pois o renderer é Puppeteer e o
 * template é um one-shot por unidade.
 */

import type {
    AnaliseFinanceira,
    BqHydratedProperty,
    JestorPayload,
    MetaDistribuicaoMensal,
} from "../types"

export interface PricingStudyData {
    payload: JestorPayload
    bq: BqHydratedProperty | null
    propertyValue: number
    propertyAppreciation: number
    metaAnual: number
    distribuicao: MetaDistribuicaoMensal[]
    analise: AnaliseFinanceira
}

const FERIADO_LABEL: Record<string, string> = {
    Janeiro: "Réveillon",
    Fevereiro: "Carnaval",
    Março: "—",
    Abril: "Páscoa/Tiradentes",
    Maio: "Dia do Trabalho",
    Junho: "Corpus Christi",
    Julho: "—",
    Agosto: "—",
    Setembro: "7 de Setembro",
    Outubro: "12 de Outubro",
    Novembro: "Finados + Consciência Negra",
    Dezembro: "—",
}

const MONTHS_ORDER = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

function brl(v: number | null | undefined): string {
    const n = Number(v) || 0
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function escapeHtml(s: string): string {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

export function renderPricingStudyHtml(data: PricingStudyData): string {
    const nome = escapeHtml(
        data.payload.rotulo ||
            data.payload.propriedade ||
            data.bq?.nomepropriedade ||
            data.bq?.nome_externo ||
            "Imóvel"
    )
    const localizacao = escapeHtml(
        data.payload.localidade || data.bq?.praca || data.bq?.cidade || "Brasil"
    )

    // monta lookup por mês
    const distMap = new Map<string, MetaDistribuicaoMensal>()
    data.distribuicao.forEach((d) => distMap.set(d.mes, d))

    const finMap = new Map<string, AnaliseFinanceira["valor_liquido_mensal"][number]>()
    data.analise.valor_liquido_mensal.forEach((m) => finMap.set(m.mes, m))

    const linhasFinanceiras = MONTHS_ORDER.map((mes) => {
        const m = finMap.get(mes)
        if (!m) {
            return `<tr><td class="font-semibold">${mes}</td><td class="text-right">—</td><td class="text-right">—</td><td class="text-right">—</td></tr>`
        }
        return `<tr>
            <td class="font-semibold">${mes}</td>
            <td class="text-right">R$ ${brl(m.receita_liquida)}</td>
            <td class="text-right">R$ ${brl(m.custo_total)}</td>
            <td class="text-right font-semibold positive">R$ ${brl(m.valor_liquido)}</td>
        </tr>`
    }).join("\n")

    const linhasMensais = MONTHS_ORDER.map((mes) => {
        const d = distMap.get(mes)
        const diaria = d ? brl(d.meta_diaria_media) : "—"
        const feriadoFat =
            d?.feriado != null
                ? `R$ ${brl(d.feriado.faturamento_feriado)} (${escapeHtml(FERIADO_LABEL[mes] || d.feriado.nome)})`
                : ` -- `
        return `<tr>
            <td class="font-semibold">${mes}</td>
            <td class="text-right">R$ ${diaria}</td>
            <td class="text-right">${feriadoFat}</td>
        </tr>`
    }).join("\n")

    const resumo = data.analise.resumo_anual

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Análise de Rentabilidade - Quarto à Vista</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body{font-family:'Inter',sans-serif;background:#f8fafc;color:#00113f;margin:0;padding:20px;font-size:14px;-webkit-font-smoothing:antialiased;}
  .container{max-width:840px;margin:auto;background:#ffffff;border:1px solid #cbe0eb;border-radius:16px;box-shadow:0 4px 12px rgba(0,17,63,.05);}
  .header{padding:20px;text-align:center;border-bottom:1px solid #cbe0eb;}
  .header h1{font-size:28px;font-weight:700;letter-spacing:-.02em;margin:0 0 4px;color:#00113f;}
  .header p{font-size:16px;color:#64748b;margin:0;}
  .content{padding:20px 40px 40px;}
  .section{margin-bottom:20px;page-break-inside:always;}
  .section-title{font-size:20px;font-weight:600;margin-bottom:20px;color:#00113f;}
  .metrics-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-bottom:25px;}
  .metric-card{border:1px solid #cbe0eb;border-radius:12px;padding:15px;text-align:center;display:flex;flex-direction:column;justify-content:center;}
  .metric-label{font-size:13px;color:#64748b;margin-bottom:8px;font-weight:500;}
  .metric-value{font-size:17px;font-weight:700;color:#00113f;}
  .metric-value.positive{color:#0091da;}
  .table-container{border:1px solid #cbe0eb;border-radius:12px;overflow:hidden;margin-bottom:25px;}
  .table{width:100%;border-collapse:collapse;font-size:13px;}
  .table th,.table td{padding:12px 16px;text-align:left;border-bottom:1px solid #cbe0eb;}
  .table tr:last-child td{border-bottom:none;}
  .table th{background:#f9fafb;font-weight:500;color:#64748b;}
  .table .text-right{text-align:right;}
  .table .font-semibold{font-weight:600;}
  .table .positive{color:#0091da;}
  .table tfoot{background:#f9fafb;font-weight:600;color:#00113f;}
  .appreciation-note{background:#f0f9ff;padding:8px;border-radius:2px;font-size:13px;margin-bottom:10px;border-left:4px solid #0091da;}
  .generic-section{background:#fff;border:1px solid #cbe0eb;border-radius:12px;padding:20px;margin-bottom:20px;}
  .footer{text-align:center;font-size:12px;color:#9ca3af;padding:30px;border-top:1px solid #cbe0eb;}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Análise de Rentabilidade by Quarto à Vista</h1>
    <p>${nome}, ${localizacao}, Brasil</p>
  </div>
  <div class="content">
    <div class="section">
      <h2 class="section-title">Overview do Investimento - Anual</h2>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Valor do Imóvel</div>
          <div class="metric-value">R$ ${brl(data.propertyValue)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Faturamento</div>
          <div class="metric-value">R$ ${brl(data.metaAnual)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Resultado Líquido</div>
          <div class="metric-value positive">R$ ${brl(resumo.valor_liquido_anual)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">ROI Anual</div>
          <div class="metric-value positive">${escapeHtml(resumo.rentabilidade_total_anual_perc)}</div>
        </div>
      </div>
      <div class="appreciation-note">
        <strong>Observação:</strong> O indicador de ROI inclui a valorização anual estimada do imóvel de ${escapeHtml(resumo.valorizacao_anual_perc)}.
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Projeção Financeira Mensal</h2>
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Mês</th>
              <th class="text-right">Receita Líquida</th>
              <th class="text-right">Custos Totais</th>
              <th class="text-right">Lucro/Prejuízo</th>
            </tr>
          </thead>
          <tbody>
            ${linhasFinanceiras}
          </tbody>
          <tfoot>
            <tr>
              <td>Total Anual</td>
              <td class="text-right">R$ ${brl(resumo.receita_liquida_anual)}</td>
              <td class="text-right">R$ ${brl(resumo.custo_total_anual)}</td>
              <td class="text-right">R$ ${brl(resumo.valor_liquido_anual)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <div class="generic-section">
      <h3 style="font-size:18px;font-weight:600;margin-bottom:16px;color:#00113f;">
        Detalhamento por mês dos valores projetados
      </h3>
      <p style="color:#374151;line-height:1.7;margin-bottom:24px;">
        O mercado de hospedagens é fortemente sazonal. Para maximizar o retorno anual, otimizamos a ocupação rentável de cada lote: diária de semana, fim de semana e pacotes de feriado. Esses valores são projeções baseadas em histórico real e podem variar até 20%.
      </p>
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Período</th>
              <th class="text-right">Diária Média</th>
              <th class="text-right">Pacote de Feriado</th>
            </tr>
          </thead>
          <tbody>
            ${linhasMensais}
          </tbody>
        </table>
      </div>
    </div>

    <div class="generic-section" style="background:#f0f9ff;border-left:4px solid #0091da;">
      <h3 style="font-size:18px;font-weight:600;margin-bottom:16px;color:#00113f;">
        O preço é o principal filtro
      </h3>
      <p style="color:#374151;line-height:1.7;">
        Quando o anúncio tem padrão Quarto à Vista, com boas fotos e divulgação, <strong>o preço decide se o hóspede clica ou passa direto</strong>.
      </p>
      <p style="color:#374151;line-height:1.7;font-weight:600;">
        Preferimos ouvir:<br>"Meu imóvel precisa faturar no mínimo R$ 2.000 este mês, é possível?"<br><br>
        Do que:<br>"Não quero alugar abaixo de R$ 400."
      </p>
    </div>
  </div>
  <div class="footer">
    Relatório gerado por Quarto à Vista © em ${new Date().toLocaleDateString("pt-BR")}.
  </div>
</div>
</body>
</html>`
}
