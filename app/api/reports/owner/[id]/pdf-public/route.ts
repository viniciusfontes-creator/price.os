/**
 * GET /api/reports/owner/[id]/pdf-public?token=<share_token>
 *
 * Versão pública (sem login) do PDF — validada por share_token. Quem clicar no
 * link de compartilhamento aterriza aqui.
 */

import { NextResponse, type NextRequest } from "next/server"
import puppeteer, { type Browser } from "puppeteer-core"
import { getOwnerReport } from "@/lib/owner-report/repository"
import { validateShare } from "@/lib/owner-report/share-token"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.nextUrl.searchParams.get("token")
  const origin = req.nextUrl.origin

  const row = await getOwnerReport(params.id)
  if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

  const check = validateShare(token, row.share_token, row.share_expires_at)
  if (!check.valid) {
    return NextResponse.json({ error: `Link inválido (${check.reason})` }, { status: 403 })
  }

  let browser: Browser | null = null
  try {
    browser = await launchBrowser()
    const page = await browser.newPage()
    const url = `${origin}/print/owner-report/${params.id}`
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 })
    await page.evaluateHandle("document.fonts.ready")
    const pdf = await page.pdf({ width: "1123px", height: "794px", printBackground: true, preferCSSPageSize: true })
    const safeName = (row.nome_propriedade || "relatorio").replace(/[^\w\-]+/g, "_")
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeName}_${row.periodo_inicio}.pdf"`,
        "Cache-Control": "private, max-age=60",
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: "Falha ao gerar PDF", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  } finally {
    if (browser) await browser.close()
  }
}
