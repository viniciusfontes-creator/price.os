import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { basketId } = body;

        console.log(`[API] Scrape request for basket ${basketId}`);

        // 1. Rate Check
        const { data: basket, error: fetchError } = await supabase
            .from('competitor_baskets')
            .select('*')
            .eq('id', basketId)
            .single();

        if (fetchError || !basket) {
            return NextResponse.json({ success: false, error: 'Basket not found' }, { status: 404 });
        }

        if (basket.last_scraped_at) {
            const lastScrape = new Date(basket.last_scraped_at);
            const now = new Date();
            const diffMs = now.getTime() - lastScrape.getTime();
            const diffMins = diffMs / 1000 / 60;

            if (diffMins < 10) {
                const waitTime = Math.ceil(10 - diffMins);
                return NextResponse.json({
                    success: false,
                    error: `Aguarde ${waitTime} minuto${waitTime > 1 ? 's' : ''} antes de atualizar novamente.`
                }, { status: 429 });
            }
        }

        // 2. Fetch External Items with full data for Payload
        const { data: basketItems } = await supabase
            .from('basket_items')
            .select('airbnb_listing_id')
            .eq('basket_id', basketId)
            .eq('item_type', 'external');

        const externalIds = basketItems?.map(i => i.airbnb_listing_id).filter(Boolean) || [];

        if (externalIds.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Nenhum concorrente externo na cesta para atualizar.'
            }, { status: 400 });
        }

        // 3. Fetch Airbnb data for each competitor to get coordinates and type
        // Use partial ID matching (first 15 digits) for precision safety
        const items: { url: string; guests: number; latitude: number; longitude: number; location_text: string }[] = [];

        for (const listingId of externalIds) {
            const safePartialId = String(listingId).substring(0, 15);

            const { data: airbnbData } = await supabase
                .from('airbnb_extrações')
                .select('url_anuncio, hospedes_adultos, latitude, longitude, tipo_propriedade')
                .ilike('url_anuncio', `%rooms/${safePartialId}%`)
                .order('data_extracao', { ascending: false })
                .limit(1)
                .single();

            if (airbnbData && airbnbData.url_anuncio && airbnbData.latitude && airbnbData.longitude) {
                items.push({
                    url: airbnbData.url_anuncio,
                    guests: airbnbData.hospedes_adultos || basket.guest_capacity || 2,
                    latitude: airbnbData.latitude,
                    longitude: airbnbData.longitude,
                    location_text: airbnbData.tipo_propriedade || basket.location || ''
                });
            } else {
                // Fallback: construct URL from ID if no data found
                // Use the original ID to construct URL (may have precision loss but it's the best we have)
                items.push({
                    url: `https://www.airbnb.com/rooms/${listingId}`,
                    guests: basket.guest_capacity || 2,
                    latitude: 0, // Unknown
                    longitude: 0, // Unknown
                    location_text: basket.location || ''
                });
            }
        }

        // 4. Send to n8n with correct payload format
        const n8nUrl = 'https://n8n.quartoavista.com.br/webhook/market-monitor';

        const payload = {
            body: {
                items
            }
        };

        console.log(`[API] Triggering n8n webhook for ${items.length} items:`, JSON.stringify(payload, null, 2));

        const n8nRes = await fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!n8nRes.ok) {
            console.error('N8n error:', n8nRes.status, n8nRes.statusText);
            throw new Error(`Falha na comunicação com o scraper (Status: ${n8nRes.status})`);
        }

        // 4. Update last_scraped_at
        const { error: updateError } = await supabase
            .from('competitor_baskets')
            .update({ last_scraped_at: new Date().toISOString() })
            .eq('id', basketId);

        if (updateError) {
            console.error('[API] Failed to update last_scraped_at:', updateError);
        }

        return NextResponse.json({ success: true, message: 'Scraping initiated successfully' });

    } catch (error: any) {
        console.error('[API] Scrape error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to trigger scrape' }, { status: 500 });
    }
}
