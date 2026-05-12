/**
 * PDF Spike — proves the Puppeteer pipeline renders a slide to PDF.
 *
 * Local dev: uses system Chrome via puppeteer-core (set CHROME_PATH env or
 * defaults to common macOS path). Production/Vercel: uses @sparticuz/chromium.
 *
 * GET /api/reports/owner/pdf-spike → application/pdf
 */

import { NextResponse } from "next/server"
import puppeteer, { type Browser } from "puppeteer-core"

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

export async function GET(req: Request) {
  // Endpoint de spike: só permitido em desenvolvimento (sem auth).
  // Em produção retorna 404 pra não expor PDFs sem credenciais.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const t0 = Date.now()
  let browser: Browser | null = null

  try {
    browser = await launchBrowser()
    const page = await browser.newPage()

    const reqUrl = new URL(req.url)
    const id = reqUrl.searchParams.get("id")
    const qs = reqUrl.searchParams.toString()
    // Se ?id=<uuid> for passado, renderiza a print page real do relatório (sem auth, só p/ teste).
    const printUrl = id
      ? `${reqUrl.origin}/print/owner-report/${id}`
      : `${reqUrl.origin}/print/owner-report/spike${qs ? `?${qs}` : ""}`

    await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 60_000 })
    await page.evaluateHandle("document.fonts.ready")

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    })

    const elapsed = Date.now() - t0
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="owner-report-spike.pdf"',
        "X-Render-Ms": String(elapsed),
      },
    })
  } catch (error) {
    console.error("[pdf-spike] error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  } finally {
    if (browser) await browser.close()
  }
}
