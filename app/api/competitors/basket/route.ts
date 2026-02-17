import { NextResponse } from 'next/server'

// In-memory storage for baskets (replace with database in production)
const baskets = new Map<string, number[]>()

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const propertyId = searchParams.get('propertyId')

        if (!propertyId) {
            return NextResponse.json(
                { success: false, error: 'Property ID is required' },
                { status: 400 }
            )
        }

        const basket = baskets.get(propertyId) || []

        return NextResponse.json({
            success: true,
            propertyId,
            competitorIds: basket,
            count: basket.length,
        })
    } catch (error) {
        console.error('[API] Error fetching basket:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch basket',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { propertyId, competitorIds } = body

        if (!propertyId || !Array.isArray(competitorIds)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Property ID and competitor IDs array are required',
                },
                { status: 400 }
            )
        }

        baskets.set(propertyId, competitorIds)

        return NextResponse.json({
            success: true,
            propertyId,
            competitorIds,
            count: competitorIds.length,
            message: 'Basket saved successfully',
        })
    } catch (error) {
        console.error('[API] Error saving basket:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to save basket',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const propertyId = searchParams.get('propertyId')
        const competitorId = searchParams.get('competitorId')

        if (!propertyId || !competitorId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Property ID and competitor ID are required',
                },
                { status: 400 }
            )
        }

        const basket = baskets.get(propertyId) || []
        const updated = basket.filter((id) => id !== parseInt(competitorId))
        baskets.set(propertyId, updated)

        return NextResponse.json({
            success: true,
            propertyId,
            competitorIds: updated,
            count: updated.length,
            message: 'Competitor removed from basket',
        })
    } catch (error) {
        console.error('[API] Error removing from basket:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to remove from basket',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
