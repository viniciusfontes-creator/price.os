import { NextResponse } from 'next/server'
import { getPricingIntelligence } from '@/lib/bigquery-service'
import { serverCache, CACHE_KEYS } from '@/lib/server-cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
    const startTime = Date.now()

    try {
        // Use server-side cache (5 min TTL) to avoid redundant BigQuery calls
        const pricingData = await serverCache.getOrFetch(
            CACHE_KEYS.PRICING_INTELLIGENCE,
            () => getPricingIntelligence(),
            300 // 5 minutes
        )

        return NextResponse.json({
            success: true,
            data: pricingData,
            fetchTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        console.error('[API] Error fetching pricing intelligence:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                data: []
            },
            { status: 500 }
        )
    }
}
