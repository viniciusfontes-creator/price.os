/**
 * Template HTML do e-mail "Boas-vindas Qavi.imob" enviado ao proprietário.
 *
 * Porte 1:1 do node "Montar HTML" do sub-workflow n8n [Owner] Apresentação.
 */

export interface OwnerWelcomeEmailData {
    ownerName: string
    nomePropriedade: string
    idPropriedade: string
}

function escapeHtml(s: string): string {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

export function renderOwnerWelcomeEmail(data: OwnerWelcomeEmailData): string {
    const firstName = data.ownerName?.split(" ")[0] || "Proprietário"
    const idProp = encodeURIComponent(data.idPropriedade)
    const nomeProp = escapeHtml(data.nomePropriedade)

    return `<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>body,table,td,p,a,span{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif !important;}</style>
</head>
<body style="margin:0;padding:0;background:#fff;color:#1d1d1f;-webkit-font-smoothing:antialiased;">
<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#fff;">
  <tr>
    <td style="padding:30px 40px;border-bottom:1px solid #f5f5f7;">
      <table width="100%">
        <tr>
          <td><span style="font-size:18px;font-weight:600;color:#001A33;">Quarto à Vista</span></td>
          <td style="text-align:right;"><span style="font-size:11px;color:#86868b;text-transform:uppercase;letter-spacing:1px;">Qavi.imob</span></td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:40px 40px 10px;">
      <h1 style="font-size:28px;line-height:1.2;font-weight:600;letter-spacing:-1px;margin:0;color:#001A33;">
        Olá, ${escapeHtml(firstName)}.
      </h1>
      <p style="font-size:17px;line-height:1.5;color:#424245;margin-top:20px;">
        Sua unidade <strong>${nomeProp}</strong> já está em nossa operação, mas quero te apresentar uma frente estratégica dos nossos negócios: a <strong>Qavi.imob</strong>.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 40px 30px;">
      <table width="100%" style="font-size:15px;color:#424245;line-height:1.6;">
        <tr><td style="padding:10px 0;border-bottom:1px solid #f5f5f7;"><strong>• Sem Exclusividade:</strong> Você tem liberdade total para manter seu imóvel em outros canais.</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #f5f5f7;"><strong>• Comissão de 5%:</strong> Valor competitivo e focado no sucesso da transação.</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #f5f5f7;"><strong>• Inteligência de Dados:</strong> Vendemos o seu imóvel como um ativo financeiro, com faturamento real e ROI comprovado.</td></tr>
        <tr><td style="padding:10px 0;"><strong>• Sem Burocracia:</strong> Nós cuidamos de toda a documentação e trâmites para você.</td></tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:0 40px 40px;">
      <div style="background:#f5f5f7;padding:30px;border-radius:18px;border:1px solid #e5e5e7;text-align:center;">
        <h2 style="font-size:19px;font-weight:600;color:#001A33;margin:0 0 10px;">Podemos anunciar sua unidade?</h2>
        <p style="font-size:14px;color:#86868b;margin-bottom:20px;">Basta responder este e-mail informando o valor que deseja receber.</p>
        <a href="mailto:viniciusfontes@quartoavista.com.br?subject=Autorizo%20Anuncio%20-%20${idProp}&body=Ol%C3%A1%2C%20autorizo%20o%20an%C3%BAncio%20da%20unidade%20${idProp}%20pelo%20valor%20de%3A%20R%24%20"
           style="display:inline-block;background:#001A33;color:#fff;padding:14px 25px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:500;">
          Sim, autorizo a venda
        </a>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:10px 40px 60px;text-align:center;">
      <p style="font-size:14px;line-height:1.6;color:#86868b;font-style:italic;margin-bottom:10px;">
        "Mas acabei de entrar e já querem que eu venda?"
      </p>
      <p style="font-size:16px;line-height:1.6;color:#424245;margin:0;">
        Calma! Adoraríamos te ter conosco por anos. Mas, se a ideia é <strong>crescer seu patrimônio</strong>, você precisa conferir as novas oportunidades do nosso portal.
      </p>
      <a href="https://qimob.app" style="display:inline-block;margin-top:20px;color:#001A33;font-weight:600;text-decoration:none;font-size:16px;border-bottom:2px solid #001A33;">
        Ver Oportunidades de Investimento →
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:30px;background:#f9f9fb;text-align:center;">
      <p style="font-size:11px;color:#b6b6bb;margin:0;text-transform:uppercase;letter-spacing:.5px;">
        ID do Ativo: ${escapeHtml(data.idPropriedade)} | Quarto à Vista &copy; ${new Date().getFullYear()}
      </p>
    </td>
  </tr>
</table>
</body>
</html>`
}

export function ownerWelcomeSubject(idPropriedade: string): string {
    return `Sobre a sua unidade ${idPropriedade} na Quarto à Vista`
}
