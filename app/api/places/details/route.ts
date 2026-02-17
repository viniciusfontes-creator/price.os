import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('placeId')
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY

    if (!placeId) {
        return NextResponse.json({ success: false, error: 'Place ID is required' }, { status: 400 })
    }

    try {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,name,formatted_address&key=${apiKey}&language=pt-BR`
        )
        const data = await response.json()

        if (data.status !== 'OK') {
            return NextResponse.json({ success: false, error: data.status }, { status: 400 })
        }

        return NextResponse.json({
            success: true,
            data: {
                name: data.result.name,
                address: data.result.formatted_address,
                location: data.result.geometry.location // { lat, lng }
            }
        })
    } catch (error) {
        console.error('[API] Place Details Error:', error)
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
