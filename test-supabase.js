require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    const { data: properties, error } = await supabase
        .from('propriedades')
        .select('*')
        .limit(2);
    console.log(error || properties);
}
test().catch(console.error);
