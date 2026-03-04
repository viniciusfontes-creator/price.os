import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _supabaseAdmin: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient | null {
    if (_supabaseAdmin) return _supabaseAdmin

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
        return null
    }

    _supabaseAdmin = createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })

    return _supabaseAdmin
}
