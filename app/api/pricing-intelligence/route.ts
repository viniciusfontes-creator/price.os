import { NextResponse } from 'next/server'
import { getPricingIntelligence } from '@/lib/bigquery-service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
    try {
        const pricingData = await getPricingIntelligence()

        return NextResponse.json({
            success: true,
            data: pricingData,
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
