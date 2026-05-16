/**
 * Template HTML do Pitchdeck Qavi.imob (7 slides A4 landscape).
 *
 * Porte 1:1 do node "Montar HTML Pitchdeck" do sub-workflow n8n.
 */

export interface PitchdeckData {
    ownerName: string
    nomePropriedade: string
    idPropriedade: string
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
const LOGO_QAVI = "https://qimob.app/logo-qavi.png"
const LOGO_QAV =
    "https://cdn.prod.website-files.com/63977cb1ecc6e0c28d964384/63977e3b4b25e34b04d3e541_QUARTO%20A%20VISTA%20PRINCIPAL.png"

function safe(v: string | null | undefined): string {
    return (v ?? "").toString()
}

const slideBase = `position:relative;width:100%;height:100vh;padding:48px 64px;box-sizing:border-box;font-family:${FONT};break-after:page;page-break-after:always;background:#fff;color:#001A33;overflow:hidden;`
const slideDark = `${slideBase}background:linear-gradient(135deg,#001A33 0%,#003366 60%,#0a4a7a 100%);background-color:#001A33;color:#fff;`

const headerLight = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;">
  <img src="${LOGO_QAVI}" alt="Qavi.imob" style="height:44px;width:auto;display:block;" />
  <div style="display:flex;align-items:center;gap:8px;">
    <span style="font-family:${FONT};font-size:10px;color:#86868b;letter-spacing:2px;text-transform:uppercase;font-weight:700;">uma iniciativa</span>
    <img src="${LOGO_QAV}" alt="Quarto à Vista" style="height:18px;display:block;" />
  </div>
</div>`

const headerDark = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;">
  <img src="${LOGO_QAVI}" alt="Qavi.imob" style="height:44px;width:auto;display:block;filter:brightness(0) invert(1);" />
  <div style="display:flex;align-items:center;gap:8px;">
    <span style="font-family:${FONT};font-size:10px;color:#7fbfff;letter-spacing:2px;text-transform:uppercase;font-weight:700;">uma iniciativa</span>
    <img src="${LOGO_QAV}" alt="Quarto à Vista" style="height:18px;display:block;filter:brightness(0) invert(1);" />
  </div>
</div>`

export function renderOwnerPitchdeckHtml(data: PitchdeckData): string {
    const ownerName = safe(data.ownerName) || "Proprietário"
    const nomeProp = safe(data.nomePropriedade)
    const idProp = safe(data.idPropriedade) || nomeProp

    const slide1 = `<section style="${slideDark}">
  <div style="display:flex;justify-content:flex-end;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-family:${FONT};font-size:10px;color:#7fbfff;letter-spacing:2px;text-transform:uppercase;font-weight:700;">uma iniciativa</span>
      <img src="${LOGO_QAV}" alt="Quarto à Vista" style="height:20px;display:block;filter:brightness(0) invert(1);" />
    </div>
  </div>
  <div style="display:flex;flex-direction:column;justify-content:center;height:calc(100% - 90px);">
    <div style="font-family:${FONT};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#7fbfff;font-weight:700;margin-bottom:20px;">OLÁ, ${ownerName.toUpperCase()}</div>
    <img src="${LOGO_QAVI}" alt="Qavi.imob" style="height:80px;width:auto;align-self:flex-start;display:block;filter:brightness(0) invert(1);margin-bottom:28px;" />
    <h1 style="font-family:${FONT};font-size:60px;font-weight:900;letter-spacing:-2.5px;line-height:1.02;margin:0;color:#fff;max-width:900px;">A nova economia dos imóveis para rentabilidade.</h1>
    <p style="font-family:${FONT};font-size:20px;line-height:1.4;color:#cfe3ff;margin:24px 0 0;font-weight:400;max-width:780px;">Compra e venda de imóveis com <strong style="color:#fff;font-weight:700;">previsão de renda</strong>, <strong style="color:#fff;font-weight:700;">curadoria</strong> e <strong style="color:#fff;font-weight:700;">dados</strong>.</p>
  </div>
  <div style="font-family:${FONT};position:absolute;bottom:40px;left:64px;font-size:11px;color:#7fbfff;letter-spacing:2px;font-weight:700;">PITCHDECK · ${new Date().toLocaleDateString("pt-BR")}</div>
</section>`

    const slideApresentando = `<section style="${slideBase}">${headerLight}
  <div style="display:flex;flex-direction:column;justify-content:center;height:calc(100% - 80px);">
    <div style="font-family:${FONT};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#86868b;font-weight:700;margin-bottom:18px;">APRESENTANDO</div>
    <h1 style="font-family:${FONT};font-size:50px;font-weight:900;letter-spacing:-2.5px;line-height:1.05;margin:0;color:#001A33;max-width:1000px;">O Qavi.imob é a iniciativa da Quarto à Vista para a <span style="color:#0066CC;">nova economia imobiliária.</span></h1>
    <p style="font-family:${FONT};font-size:18px;color:#424245;margin:24px 0 0;line-height:1.5;max-width:960px;">Focada em <strong style="color:#001A33;">compra e venda de imóveis voltados para rentabilidade</strong> — short stay prontos para gerar renda. Conectamos diretamente proprietários e investidores em uma plataforma orientada por dados.</p>
  </div>
</section>`

    const card2 = (title: string, body: string) =>
        `<td style="width:50%;padding:8px;vertical-align:top;height:1px;"><div style="background:#f5f5f7;border-radius:22px;padding:26px;min-height:130px;height:100%;box-sizing:border-box;"><div style="font-family:${FONT};font-size:16px;font-weight:700;margin-bottom:8px;color:#001A33;">${title}</div><div style="font-family:${FONT};font-size:13.5px;color:#424245;line-height:1.5;">${body}</div></div></td>`

    const slide2 = `<section style="${slideBase}">${headerLight}
  <div style="font-family:${FONT};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#86868b;font-weight:700;margin-bottom:14px;">O CONTEXTO</div>
  <h1 style="font-family:${FONT};font-size:46px;font-weight:900;letter-spacing:-2px;line-height:1.05;margin:0;color:#001A33;max-width:1000px;">O mercado imobiliário ainda funciona <span style="color:#0066CC;">no escuro.</span></h1>
  <p style="font-family:${FONT};font-size:17px;color:#424245;margin:16px 0 22px;line-height:1.45;max-width:920px;">Mesmo um imóvel de altíssima qualidade enfrenta os mesmos quatro obstáculos sempre que entra à venda.</p>
  <table style="width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;height:1px;">
    <tr>${card2("Avaliação subjetiva", "O preço é definido por opinião, não por dados de performance.")}${card2("Falta de transparência", "O proprietário não sabe quem viu, quem se interessou, ou por que não fechou.")}</tr>
    <tr>${card2("Liquidez baixa", "Imóveis de hospitalidade levam meses até encontrar o investidor certo.")}${card2("Sem previsão de renda", "A maioria dos anúncios não comprovem faturamento real — só promete sem fundamento.")}</tr>
  </table>
</section>`

    const pillar = (n: string, title: string, body: string) =>
        `<td style="width:33.33%;padding:8px;vertical-align:top;height:1px;"><div style="border:2px solid #001A33;border-radius:22px;padding:26px;min-height:240px;height:100%;box-sizing:border-box;display:flex;flex-direction:column;"><div style="font-family:${FONT};font-size:40px;font-weight:900;color:#001A33;line-height:1;margin-bottom:10px;">${n}</div><div style="font-family:${FONT};font-size:18px;font-weight:700;margin:0 0 8px;color:#001A33;">${title}</div><div style="font-family:${FONT};font-size:13.5px;color:#424245;line-height:1.5;">${body}</div></div></td>`

    const slide3 = `<section style="${slideBase}">${headerLight}
  <div style="font-family:${FONT};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#86868b;font-weight:700;margin-bottom:14px;">QUEM SOMOS</div>
  <h1 style="font-family:${FONT};font-size:44px;font-weight:900;letter-spacing:-2px;line-height:1.05;margin:0;color:#001A33;max-width:1000px;">Transformamos imóveis em <span style="color:#0066CC;">ativos financeiros comparáveis.</span></h1>
  <p style="font-family:${FONT};font-size:16px;color:#424245;margin:16px 0 22px;line-height:1.5;max-width:1000px;">A Qavi.imob é a unidade de negócios da Quarto à Vista para venda e negociação de imóveis de short stay e hospitalidade.</p>
  <table style="width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;height:1px;"><tr>
    ${pillar("01", "Dados", "Cada unidade entra com estudo de rentabilidade, ocupação histórica e faturamento projetado.")}
    ${pillar("02", "Liquidez", "Conexão direta com base de investidores que busca ativos turnkey, prontos para render.")}
    ${pillar("03", "Curadoria", "Validamos jurídico e operacional antes de listar. Propostas mais qualificadas.")}
  </tr></table>
</section>`

    const persona = (tag: string, title: string, body: string, highlight: boolean) => {
        const bg = highlight
            ? "background:linear-gradient(135deg,#001A33 0%,#003366 100%);background-color:#001A33;color:#fff;"
            : "background:#f5f5f7;"
        const tagColor = highlight ? "#7fbfff" : "#0066CC"
        const titleColor = highlight ? "#fff" : "#001A33"
        const bodyColor = highlight ? "#cfe3ff" : "#424245"
        return `<td style="width:33.33%;padding:8px;vertical-align:top;height:1px;"><div style="${bg}border-radius:22px;padding:24px;min-height:260px;height:100%;box-sizing:border-box;display:flex;flex-direction:column;"><div style="font-family:${FONT};font-size:11px;font-weight:700;color:${tagColor};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px;">${tag}</div><div style="font-family:${FONT};font-size:19px;font-weight:700;line-height:1.2;margin:0 0 10px;color:${titleColor};">${title}</div><div style="font-family:${FONT};font-size:13px;color:${bodyColor};line-height:1.5;">${body}</div></div></td>`
    }

    const slide4 = `<section style="${slideBase}">${headerLight}
  <div style="font-family:${FONT};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#86868b;font-weight:700;margin-bottom:14px;">PARA QUEM</div>
  <h1 style="font-family:${FONT};font-size:46px;font-weight:900;letter-spacing:-2px;line-height:1.05;margin:0 0 20px;color:#001A33;">Três perfis. <span style="color:#0066CC;">Uma plataforma.</span></h1>
  <table style="width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;height:1px;"><tr>
    ${persona("Proprietário", "Quer vender com inteligência.", "Transforma seu investimento imobiliário em capital líquido, sem perder o controle do preço nem da operação até o aceite.", false)}
    ${persona("Investidor", "Busca renda turnkey.", "Ativos com previsão de faturamento, ocupação validada e curadoria jurídica completa antes de comprar.", false)}
    ${persona("Incorporador", "Da nova economia.", "Mudando o jeito de comprar na planta — preview de decoração via IA, pagamento no cartão, acompanhamento digital da obra.", true)}
  </tr></table>
</section>`

    const stepCard = (icon: string, title: string, body: string) =>
        `<td style="width:50%;padding:8px;vertical-align:top;height:1px;"><div style="background:#f5f5f7;border-radius:22px;padding:24px;min-height:160px;height:100%;box-sizing:border-box;display:flex;align-items:flex-start;gap:18px;"><div style="width:52px;height:52px;border-radius:16px;background:#001A33;color:#fff;font-family:${FONT};font-size:24px;text-align:center;line-height:52px;flex-shrink:0;">${icon}</div><div><div style="font-family:${FONT};font-size:18px;font-weight:700;color:#001A33;margin-bottom:4px;">${title}</div><div style="font-family:${FONT};font-size:13.5px;color:#424245;line-height:1.5;">${body}</div></div></div></td>`

    const slide5 = `<section style="${slideBase}">${headerLight}
  <div style="font-family:${FONT};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#86868b;font-weight:700;margin-bottom:14px;">COMO FUNCIONA</div>
  <h1 style="font-family:${FONT};font-size:42px;font-weight:900;letter-spacing:-2px;line-height:1.05;margin:0 0 8px;color:#001A33;">Transparência operacional, <span style="color:#0066CC;">do anúncio ao recebimento.</span></h1>
  <p style="font-family:${FONT};font-size:15.5px;color:#424245;margin:0 0 20px;line-height:1.5;max-width:900px;">Quatro princípios não-negociáveis que regem cada listagem.</p>
  <table style="width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;height:1px;">
    <tr>${stepCard("⛓️", "Sem exclusividade", "Você não precisa retirar o imóvel de nenhum outro canal. Anuncie em paralelo livremente.")}${stepCard("%", "Comissão de 5%", "Aplicada apenas sobre o sucesso da venda. Sem mensalidade, sem taxa de listagem.")}</tr>
    <tr>${stepCard("✓", "Validação de propostas", "Toda oferta passa por você antes do aceite. Você define o piso, nós levamos os candidatos.")}${stepCard("§", "Burocracia inclusa", "Documentação, due diligence, contratos e trâmite ficam por nossa conta.")}</tr>
  </table>
</section>`

    const ctaCard = (icon: string, title: string, body: string) =>
        `<td style="width:50%;padding:8px;vertical-align:top;height:1px;"><div style="background:#fff;color:#001A33;border-radius:20px;padding:26px;min-height:170px;height:100%;box-sizing:border-box;text-align:center;display:flex;flex-direction:column;justify-content:center;"><div style="font-family:${FONT};font-size:32px;margin-bottom:8px;">${icon}</div><div style="font-family:${FONT};font-size:17px;font-weight:700;color:#001A33;margin-bottom:6px;">${title}</div><div style="font-family:${FONT};font-size:13px;color:#424245;line-height:1.5;">${body}</div></div></td>`

    const slide6 = `<section style="${slideDark}">${headerDark}
  <div style="display:flex;flex-direction:column;justify-content:center;height:calc(100% - 80px);">
    <div style="font-family:${FONT};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#7fbfff;font-weight:700;margin-bottom:16px;text-align:center;">PRÓXIMO PASSO</div>
    <h1 style="font-family:${FONT};font-size:54px;font-weight:900;letter-spacing:-2.5px;line-height:1.05;margin:0 auto 18px;max-width:900px;color:#fff;text-align:center;">Podemos anunciar seu imóvel?</h1>
    <p style="font-family:${FONT};font-size:18px;color:#cfe3ff;margin:0 auto 24px;line-height:1.45;max-width:850px;text-align:center;">Responda <strong style="color:#fff;">aqui no grupo</strong> o valor que você gostaria de anunciar a unidade <strong style="color:#fff;">${idProp}</strong> — ou responda <strong style="color:#fff;">por e-mail</strong>, já que enviamos esta apresentação por lá também.</p>
    <table style="width:100%;max-width:880px;margin:0 auto;border-collapse:separate;border-spacing:0;table-layout:fixed;height:1px;"><tr>
      ${ctaCard("💬", "Responder neste grupo", "Mencione a unidade que se refere e o valor desejado")}
      ${ctaCard("✉️", "Responder por e-mail", "Basta responder ao e-mail de boas-vindas com esta apresentação.")}
    </tr></table>
  </div>
</section>`

    const slide7 = `<section style="${slideBase}page-break-after:auto;break-after:auto;">${headerLight}
  <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:calc(100% - 80px);text-align:center;">
    <div style="font-family:${FONT};font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#86868b;font-weight:700;margin-bottom:24px;">PENSANDO EM INVESTIR?</div>
    <h1 style="font-family:${FONT};font-size:48px;font-weight:900;letter-spacing:-2px;line-height:1.15;margin:0;max-width:980px;color:#001A33;">Acesse nosso portal e verifique <span style="color:#0066CC;">as principais oportunidades.</span></h1>
    <a href="https://qimob.app" style="display:inline-block;background:#001A33;color:#fff;padding:18px 36px;border-radius:48px;font-family:${FONT};font-size:18px;font-weight:700;letter-spacing:.3px;text-decoration:none;margin-top:36px;">Site-Qavi.imob</a>
  </div>
</section>`

    return `<!DOCTYPE html><html lang="pt-br"><head><meta charset="UTF-8"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet"><style>@page{size:A4 landscape;margin:0;}html,body{margin:0;padding:0;width:100%;font-family:${FONT};}*{box-sizing:border-box;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important;}section{position:relative;}img{max-width:100%;}</style></head><body>${slide1}${slideApresentando}${slide2}${slide3}${slide4}${slide5}${slide6}${slide7}</body></html>`
}

export function pitchdeckFileName(nomePropriedade: string): string {
    const slug = (nomePropriedade || "unidade").replace(/[^a-zA-Z0-9]+/g, "-")
    return `Pitchdeck-Qavi-${slug}.pdf`
}
