import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkTables() {
  console.log('🔍 Checking Supabase tables...\n')

  const tables = [
    'pricing_periods',
    'seasonalities',
    'seasonality_pracas',
    'seasonality_periods'
  ]

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (error) {
        console.log(`❌ Table "${table}": ${error.message}`)
      } else {
        console.log(`✅ Table "${table}" exists (${count || 0} rows)`)
      }
    } catch (err: any) {
      console.log(`❌ Table "${table}": ${err.message}`)
    }
  }

  console.log('\n💡 If tables are missing, run the migration in Supabase SQL Editor:')
  console.log('   https://supabase.com/dashboard/project/ptqfxeakzjwtukcajoex/sql/new')
  console.log('   Then paste the content of: migrations/004_seasonalities_and_periods.sql')
}

checkTables()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
