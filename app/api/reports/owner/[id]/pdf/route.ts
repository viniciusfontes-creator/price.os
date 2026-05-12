/**
 * GET /api/reports/owner/[id]/pdf
 * Renderiza /print/owner-report/[id] em PDF com Puppeteer.
 *
 * Auth: exige sessão NextAuth e que o usuário seja o autor do relatório.
 */

import { NextResponse } from "next/server"
import puppeteer, { type Browser } from "puppeteer-core"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getOwnerReport } from "@/lib/owner-report/repository"

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

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const t0 = Date.now()

  let email: string | null = null
  try {
    const session = await getServerSession(authOptions)
    email = session?.user?.email || null
  } catch {}
  if (!email) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const row = await getOwnerReport(params.id)
  if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  if (row.created_by_email !== email) {
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 })
  }

  let browser: Browser | null = null
  try {
    browser = await launchBrowser()
    const page = await browser.newPage()
    const url = `${new URL(req.url).origin}/print/owner-report/${params.id}`
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 })
    await page.evaluateHandle("document.fonts.ready")

    const pdf = await page.pdf({
      width: "1123px",
      height: "794px",
      printBackground: true,
      preferCSSPageSize: true,
    })

    const safeName = (row.nome_propriedade || "relatorio").replace(/[^\w\-]+/g, "_")
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeName}_${row.periodo_inicio}.pdf"`,
        "X-Render-Ms": String(Date.now() - t0),
      },
    })
  } catch (err) {
    console.error("[pdf] error:", err)
    return NextResponse.json(
      { error: "Falha ao gerar PDF", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  } finally {
    if (browser) await browser.close()
  }
}
