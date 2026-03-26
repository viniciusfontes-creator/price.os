import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-client'

export const dynamic = 'force-dynamic'

// GET: fetch all seasonalities with their praças and period percentages
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('seasonalities')
      .select('*, seasonality_pracas(*), seasonality_periods(*)')
      .order('name', { ascending: true })

    if (error) throw error
    return NextResponse.json({ success: true, data: data || [] })
  } catch (err: any) {
    console.error('[API] Error fetching seasonalities:', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar sazonalidades' }, { status: 500 })
  }
}

// POST: create a new seasonality with praças and period percentages
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, pracas, periods } = body as {
      name: string
      pracas: string[]
      periods: { period_id: string; percent: number; expected_nights?: number | null }[]
    }

    if (!name) {
      return NextResponse.json({ success: false, error: 'Nome obrigatório' }, { status: 400 })
    }

    // Create seasonality
    const { data: seasonality, error: sError } = await supabase
      .from('seasonalities')
      .insert([{ name }])
      .select()
      .single()

    if (sError) throw sError

    // Assign praças
    if (pracas && pracas.length > 0) {
      // Remove these praças from any existing seasonality first
      await supabase
        .from('seasonality_pracas')
        .delete()
        .in('praca', pracas)

      const { error: pError } = await supabase
        .from('seasonality_pracas')
        .insert(pracas.map(praca => ({ seasonality_id: seasonality.id, praca })))

      if (pError) throw pError
    }

    // Set period percentages
    if (periods && periods.length > 0) {
      const { error: ppError } = await supabase
        .from('seasonality_periods')
        .insert(periods.map(p => ({
          seasonality_id: seasonality.id,
          period_id: p.period_id,
          percent: p.percent,
          expected_nights: p.expected_nights ?? null,
        })))

      if (ppError) throw ppError
    }

    // Fetch complete result
    const { data: result } = await supabase
      .from('seasonalities')
      .select('*, seasonality_pracas(*), seasonality_periods(*)')
      .eq('id', seasonality.id)
      .single()

    return NextResponse.json({ success: true, data: result })
  } catch (err: any) {
    console.error('[API] Error creating seasonality:', err)
    return NextResponse.json({ success: false, error: 'Erro ao criar sazonalidade' }, { status: 500 })
  }
}

// PUT: update seasonality (name, praças, period percentages)
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name, pracas, periods } = body as {
      id: string
      name?: string
      pracas?: string[]
      periods?: { period_id: string; percent: number; expected_nights?: number | null }[]
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID obrigatório' }, { status: 400 })
    }

    // Update name if provided
    if (name) {
      const { error } = await supabase
        .from('seasonalities')
        .update({ name })
        .eq('id', id)

      if (error) throw error
    }

    // Update praças if provided
    if (pracas) {
      // Remove current praças for this seasonality
      await supabase
        .from('seasonality_pracas')
        .delete()
        .eq('seasonality_id', id)

      // Remove these praças from other seasonalities
      if (pracas.length > 0) {
        await supabase
          .from('seasonality_pracas')
          .delete()
          .in('praca', pracas)

        const { error: pError } = await supabase
          .from('seasonality_pracas')
          .insert(pracas.map(praca => ({ seasonality_id: id, praca })))

        if (pError) throw pError
      }
    }

    // Update period percentages if provided
    if (periods) {
      // Remove existing percentages
      await supabase
        .from('seasonality_periods')
        .delete()
        .eq('seasonality_id', id)

      if (periods.length > 0) {
        const { error: ppError } = await supabase
          .from('seasonality_periods')
          .insert(periods.map(p => ({
            seasonality_id: id,
            period_id: p.period_id,
            percent: p.percent,
            expected_nights: p.expected_nights ?? null,
          })))

        if (ppError) throw ppError
      }
    }

    // Fetch complete result
    const { data: result } = await supabase
      .from('seasonalities')
      .select('*, seasonality_pracas(*), seasonality_periods(*)')
      .eq('id', id)
      .single()

    return NextResponse.json({ success: true, data: result })
  } catch (err: any) {
    console.error('[API] Error updating seasonality:', err)
    return NextResponse.json({ success: false, error: 'Erro ao atualizar sazonalidade' }, { status: 500 })
  }
}

// DELETE: remove a seasonality and cascade praças/percentages
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID obrigatório' }, { status: 400 })
    }

    const { error } = await supabase
      .from('seasonalities')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[API] Error deleting seasonality:', err)
    return NextResponse.json({ success: false, error: 'Erro ao excluir sazonalidade' }, { status: 500 })
  }
}
