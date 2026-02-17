/**
 * API Route: /api/dashboard/data
 * 
 * Fetches integrated data from BigQuery for the dashboard using 
 * the standardized service layer.
 */

import { NextResponse } from 'next/server'
import { getIntegratedDataFromBigQuery } from '@/lib/bigquery-service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
    const startTime = Date.now()

    try {
        console.log('[API] Fetching standardized dashboard data...')
        const data = await getIntegratedDataFromBigQuery()

        if (!data || data.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'No data returned from BigQuery',
                    source: 'bigquery-empty'
                },
                { status: 404 }
            )
        }

        // Calculate stats for response
        const stats = {
            properties: data.length,
            reservations: data.reduce((acc, curr) => acc + (curr.reservas?.length || 0), 0),
            goals: data.reduce((acc, curr) => acc + (curr.metas?.length || 0), 0)
        }

        return NextResponse.json({
            success: true,
            source: 'bigquery',
            data: data,
            count: data.length,
            stats,
            fetchTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
        })

    } catch (error) {
        console.error('[API] Dashboard data fetch error:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch data from BigQuery',
                details: String(error),
            },
            { status: 500 }
        )
    }
}
