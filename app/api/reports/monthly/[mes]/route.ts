/**
 * API Route: /api/reports/monthly/[mes]
 *
 * Returns a pre-aggregated monthly report payload for a given month (YYYY-MM).
 * Reuses the BigQuery integrated data fetch + 5min server cache.
 */

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { serverCache } from '@/lib/server-cache'
import { getMonthlyReport, isValidMes } from '@/lib/monthly-report-service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(_req: Request, { params }: { params: { mes: string } }) {
  const startTime = Date.now()
  const headersList = headers()
  const viewContext = headersList.get('x-view-context') || 'overview'
  const mes = params.mes

  if (!isValidMes(mes)) {
    return NextResponse.json(
      { success: false, error: `Formato inválido. Esperado YYYY-MM, recebido: ${mes}` },
      { status: 400 }
    )
  }

  try {
    const cacheKey = `report_monthly_${mes}_${viewContext}`
    const payload = await serverCache.getOrFetch(
      cacheKey,
      () => getMonthlyReport(mes, viewContext),
      300
    )

    return NextResponse.json({
      success: true,
      data: payload,
      fetchTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[API] Monthly report error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Falha ao gerar relatório mensal',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
