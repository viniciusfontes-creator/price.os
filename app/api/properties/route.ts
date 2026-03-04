import { NextResponse } from 'next/server'
import { getPropriedades } from '@/lib/bigquery-service'

export async function GET() {
    try {
        const properties = await getPropriedades()

        // Map types to our internal response format
        const formattedProperties = (properties as any[]).map(p => ({
            idpropriedade: p.idpropriedade,
            nome: p.name || p.nomepropriedade || p.nome_externo || `Imóvel Interno ${p.idpropriedade}`,
            propertyKey: p.idpropriedade, // Using id as key
            quantidade_quartos: p._i_rooms?.toString() || '0',
            cidade: p.cidade,
            praca: p.praca,
            grupo_nome: p.grupo_nome,
            empreendimento_pousada: p.empreendimento_pousada,
            latitude: p.latitude,
            longitude: p.longitude,
            valor_tarifario: p.valor_tarifario
        }))

        return NextResponse.json({ success: true, data: formattedProperties })
    } catch (error) {
        console.error('[API] Error fetching properties from BigQuery:', error)
        return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
    }
}
