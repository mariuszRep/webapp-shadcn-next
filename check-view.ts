import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkView() {
  console.log('🔍 Checking database state...\n')

  // Check permissions table
  const { data: perms, error: permsError } = await supabase
    .from('permissions')
    .select('*')
    .is('deleted_at', null)

  console.log('📊 Permissions table:')
  console.log(`   Count: ${perms?.length || 0}`)
  if (permsError) console.log(`   Error: ${permsError.message}`)
  else console.log(`   Sample:`, perms?.slice(0, 2))

  // Check view
  const { data: viewData, error: viewError } = await supabase
    .from('users_permissions')
    .select('*')

  console.log('\n📊 users_permissions view:')
  console.log(`   Count: ${viewData?.length || 0}`)
  if (viewError) console.log(`   Error: ${viewError.message}`)
  else console.log(`   Sample:`, viewData?.slice(0, 2))

  // Check if triggers exist
  const { data: triggers, error: trigError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT trigger_name, event_manipulation, event_object_table
      FROM information_schema.triggers
      WHERE trigger_name LIKE '%users_permissions%'
    `
  }).catch(() => ({ data: null, error: { message: 'RPC not available' } }))

  console.log('\n🔧 Triggers:')
  if (trigError) console.log(`   Cannot check (${trigError.message})`)
  else console.log(`   Found: ${triggers?.length || 0}`)

  // Try manual refresh
  console.log('\n♻️  Attempting manual refresh...')
  const { error: refreshError } = await supabase.rpc('exec_sql', {
    sql: 'REFRESH MATERIALIZED VIEW CONCURRENTLY public.users_permissions'
  }).catch(() => ({ error: { message: 'Cannot refresh via RPC' } }))

  if (refreshError) console.log(`   ${refreshError.message}`)
  else console.log('   ✅ Manual refresh successful')
}

checkView().catch(console.error)
