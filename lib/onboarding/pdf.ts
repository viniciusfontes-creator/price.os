/**
 * Utility de geração de PDF a partir de HTML usando Puppeteer.
 *
 * Reusa o padrão de [app/api/reports/owner/[id]/pdf/route.ts]: em produção
 * usa @sparticuz/chromium (serverless), em dev usa o Chrome local do macOS.
 */

import puppeteer, { type Browser, type PDFOptions } from "puppeteer-core"

const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

async function launchBrowser(): Promise<Browser> {
    const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production"
    if (isProd) {
        const chromium = (await import("@sparticuz/chromium")).default
        return puppeteer.launch({
            args: chromium.args,
            defaultViewport: { width: 1123, height: 794, deviceScaleFactor: 2 },
            executablePath: await chromium.executablePath(),
            headless: true,
        })
    }
    return puppeteer.launch({
        executablePath: process.env.CHROME_PATH || MAC_CHROME,
        defaultViewport: { width: 1123, height: 794, deviceScaleFactor: 2 },
        headless: true,
    })
}

export interface PdfOptions {
    /** A4 portrait (default) ou landscape (pitchdeck). */
    landscape?: boolean
    /** Margens em mm; default 0 (template já cuida do padding). */
    margin?: { top?: string; right?: string; bottom?: string; left?: string }
    /** Tempo máximo em ms para o navegador renderizar. */
    timeoutMs?: number
}

/**
 * Renderiza um HTML completo em PDF e retorna o buffer.
 */
export async function htmlToPdfBuffer(
    html: string,
    opts: PdfOptions = {}
): Promise<Uint8Array> {
    const browser = await launchBrowser()
    try {
        const page = await browser.newPage()
        await page.setContent(html, { waitUntil: "load", timeout: opts.timeoutMs ?? 60000 })
        const pdfOptions: PDFOptions = {
            format: "A4",
            landscape: !!opts.landscape,
            printBackground: true,
            margin: opts.margin ?? { top: "0", right: "0", bottom: "0", left: "0" },
        }
        const buffer = await page.pdf(pdfOptions)
        return new Uint8Array(buffer)
    } finally {
        await browser.close().catch(() => undefined)
    }
}
