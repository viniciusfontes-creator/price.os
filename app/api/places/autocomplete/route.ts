import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const input = searchParams.get('input')
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY

    if (!input) {
        return NextResponse.json({ success: false, error: 'Input is required' }, { status: 400 })
    }

    try {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
                input
            )}&key=${apiKey}&language=pt-BR`
        )
        const data = await response.json()

        return NextResponse.json({ success: true, data: data.predictions || [] })
    } catch (error) {
        console.error('[API] Places Autocomplete Error:', error)
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
