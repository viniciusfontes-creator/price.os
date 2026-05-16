/**
 * Cliente Gmail (envio de e-mail ao proprietário).
 *
 * Em dry-run NÃO envia — só loga assunto, destinatário e snippet do HTML.
 *
 * Em produção usa OAuth2 com refresh token (mesma conta Gmail vinculada
 * no n8n: viniciusfontes@quartoavista.com.br).
 */

import { isDryRun } from "./constants"

export interface SendEmailInput {
    to: string
    subject: string
    htmlBody: string
}

export interface SendEmailResult {
    skipped: boolean
    messageId?: string
    threadId?: string
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    if (isDryRun()) {
        const snippet = input.htmlBody.replace(/<[^>]+>/g, " ").slice(0, 120)
        console.log(
            `[onboarding/gmail] DRY-RUN — to=${input.to} subject="${input.subject}"\n  snippet: ${snippet}...`
        )
        return { skipped: true }
    }

    const clientId = process.env.GMAIL_OAUTH_CLIENT_ID
    const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET
    const refreshToken = process.env.GMAIL_OAUTH_REFRESH_TOKEN
    const fromEmail = process.env.GMAIL_FROM_EMAIL || "viniciusfontes@quartoavista.com.br"

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error(
            "Credenciais Gmail OAuth ausentes (GMAIL_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN)"
        )
    }

    const { google } = await import("googleapis")
    const oAuth2 = new google.auth.OAuth2(clientId, clientSecret)
    oAuth2.setCredentials({ refresh_token: refreshToken })

    const gmail = google.gmail({ version: "v1", auth: oAuth2 })

    const raw = buildRawMessage({
        from: fromEmail,
        to: input.to,
        subject: input.subject,
        html: input.htmlBody,
    })

    const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
    })

    return {
        skipped: false,
        messageId: res.data.id || undefined,
        threadId: res.data.threadId || undefined,
    }
}

function buildRawMessage(args: {
    from: string
    to: string
    subject: string
    html: string
}): string {
    const lines = [
        `From: ${args.from}`,
        `To: ${args.to}`,
        `Subject: =?UTF-8?B?${Buffer.from(args.subject).toString("base64")}?=`,
        "MIME-Version: 1.0",
        'Content-Type: text/html; charset="UTF-8"',
        "Content-Transfer-Encoding: base64",
        "",
        Buffer.from(args.html).toString("base64"),
    ]
    const message = lines.join("\r\n")
    return Buffer.from(message)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
}
