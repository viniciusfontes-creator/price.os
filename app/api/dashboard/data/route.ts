/**
 * API Route: /api/dashboard/data
 * 
 * Fetches integrated data from BigQuery for the dashboard using 
 * the standardized service layer.
 */

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getIntegratedDataFromBigQuery } from '@/lib/bigquery-service'
import { serverCache, CACHE_KEYS } from '@/lib/server-cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
    const startTime = Date.now()
    const headersList = headers()
    const viewContext = headersList.get('x-view-context') || 'overview'

    try {
        const cacheKey = `${CACHE_KEYS.DASHBOARD_DATA}_${viewContext}`

        // Use server-side cache (5 min TTL) to avoid redundant BigQuery calls
        const { data, cached } = await serverCache.getOrFetch(
            cacheKey,
            async () => {
                const result = await getIntegratedDataFromBigQuery(viewContext)
                return { data: result, cached: false }
            },
            300 // 5 minutes
        )

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
            reservations: data.reduce((acc: number, curr: any) => acc + (curr.reservas?.length || 0), 0),
            goals: data.reduce((acc: number, curr: any) => acc + (curr.metas?.length || 0), 0)
        }

        return NextResponse.json({
            success: true,
            source: cached ? 'bigquery-cached' : 'bigquery',
            data: data,
            count: data.length,
            stats,
            fetchTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            cached: !cached ? false : true, // first fetch sets cached=false
        })

    } catch (error) {
        console.error('[API] Dashboard data fetch error:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch data from BigQuery',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        )
    }
}
