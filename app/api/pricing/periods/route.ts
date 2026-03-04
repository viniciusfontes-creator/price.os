import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('pricing_periods')
      .select('*')
      .order('start_date', { ascending: true })

    if (error) throw error
    return NextResponse.json({ success: true, data: data || [] })
  } catch (err: any) {
    console.error('[API] Error fetching periods:', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar períodos' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, short_name, start_date, end_date, type, expected_nights, sort_order } = body

    if (!name || !short_name || !start_date || !end_date || !type) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios: name, short_name, start_date, end_date, type' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('pricing_periods')
      .insert([{ name, short_name, start_date, end_date, type, expected_nights: expected_nights || 15, sort_order: sort_order || 0 }])
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error('[API] Error creating period:', err)
    return NextResponse.json({ success: false, error: 'Erro ao criar período' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, ...rawUpdates } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID obrigatório' }, { status: 400 })
    }

    // Filter out undefined/null values to avoid NOT NULL constraint violations
    const allowedFields = ['name', 'short_name', 'start_date', 'end_date', 'type', 'expected_nights', 'sort_order']
    const updates: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (rawUpdates[key] !== undefined && rawUpdates[key] !== null) {
        updates[key] = rawUpdates[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum campo para atualizar' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('pricing_periods')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error('[API] Error updating period:', err?.message || err)
    return NextResponse.json({ success: false, error: err?.message || 'Erro ao atualizar período' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID obrigatório' }, { status: 400 })
    }

    const { error } = await supabase
      .from('pricing_periods')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[API] Error deleting period:', err)
    return NextResponse.json({ success: false, error: 'Erro ao excluir período' }, { status: 500 })
  }
}
