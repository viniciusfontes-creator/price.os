import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  const migrationFile = path.join(process.cwd(), 'migrations', '004_seasonalities_and_periods.sql')

  console.log('📄 Reading migration file...')
  const sql = fs.readFileSync(migrationFile, 'utf-8')

  console.log('🚀 Running migration...')

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

  if (error) {
    // Try direct execution if exec_sql RPC doesn't exist
    console.log('⚠️  RPC method not available, trying direct execution...')
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)

    for (const statement of statements) {
      if (statement.startsWith('--')) continue

      console.log(`  Executing: ${statement.substring(0, 50)}...`)

      const { error: execError } = await supabase.rpc('exec', {
        query: statement
      })

      if (execError) {
        console.error(`❌ Error executing statement:`, execError)
        console.error(`Statement: ${statement}`)
        // Continue with other statements
      }
    }
  } else {
    console.log('✅ Migration executed successfully!')
  }

  // Verify tables were created
  console.log('\n🔍 Verifying tables...')
  const tables = ['pricing_periods', 'seasonalities', 'seasonality_pracas', 'seasonality_periods']

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1)
    if (error) {
      console.log(`  ❌ Table ${table}: ${error.message}`)
    } else {
      console.log(`  ✅ Table ${table} exists`)
    }
  }
}

runMigration()
  .then(() => {
    console.log('\n✅ Migration process complete!')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Migration failed:', err)
    process.exit(1)
  })
