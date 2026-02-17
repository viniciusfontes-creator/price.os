
const { createClient } = require('@supabase/supabase-js');

// Hardcoded for diagnostic purpose only
const supabaseUrl = 'https://ptqfxeakzjwtukcajoex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0cWZ4ZWFremp3dHVrY2Fqb2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NDAwMTYsImV4cCI6MjA3NDQxNjAxNn0.uVWAXd4N6mmGEbtb1iEIjYVy3y5Wt1t-BX8-f-faUm0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('--- Diagnosing airbnb_extrações ---');

    try {
        // 1. Get a sample of columns
        const { data: sample, error: sampleError } = await supabase
            .from('airbnb_extrações')
            .select('*')
            .limit(1);

        if (sampleError) {
            console.error('Error fetching sample:', JSON.stringify(sampleError, null, 2));
            return;
        }

        if (!sample || sample.length === 0) {
            console.log('No data found in airbnb_extrações');
            return;
        }

        console.log('Columns available:', Object.keys(sample[0]));
        console.log('Sample Data:', JSON.stringify(sample[0], null, 2));

        // 2. Check for a specific listing (get one from the table first)
        const listingId = sample[0].id;
        const idNumerica = sample[0].id_numerica;
        const url = sample[0].url_anuncio;

        console.log(`Testing with row id: ${listingId}, id_numerica: ${idNumerica}, url: ${url}`);

        // 3. Try to find other records with the same identifier
        console.log('Checking history by url_anuncio...');
        const { data: history, error: historyError } = await supabase
            .from('airbnb_extrações')
            .select('id, data_extracao, checkin_formatado')
            .eq('url_anuncio', url)
            .limit(10);

        console.log(`History records found for URL: ${history?.length || 0}`);
        if (history && history.length > 0) {
            console.log('Sample history dates:', history.map(h => ({ ext: h.data_extracao, chk: h.checkin_formatado })));
        }

        if (idNumerica) {
            console.log('Checking history by id_numerica...');
            const { data: historyNum } = await supabase
                .from('airbnb_extrações')
                .select('id')
                .eq('id_numerica', idNumerica);
            console.log(`History records found for id_numerica: ${historyNum?.length || 0}`);
        }
    } catch (e) {
        console.error('Fatal diagnostic error:', e);
    }
}

diagnose();
