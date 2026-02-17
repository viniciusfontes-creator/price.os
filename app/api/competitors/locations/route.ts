import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-client'

export async function GET() {
    try {
        const { data, error } = await supabase.rpc('get_unique_locations')

        if (error) {
            console.error('Error fetching locations:', error)
            return NextResponse.json(
                { success: false, error: 'Database function error', details: error.message },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            data,
        }, {
            headers: {
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
            }
        })
    } catch (error) {
        console.error('[API] Error fetching locations:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
