import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
const env: Record<string, string> = {}
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=')
  if (key && values.length) env[key.trim()] = values.join('=').trim()
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const EMAIL = process.argv[2] || 'mariuszrepczynski@gmail.com'

async function checkUser() {
  console.log(`Checking RBAC setup for: ${EMAIL}\n`)

  // Get user
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === EMAIL)

  if (!user) {
    console.log(`❌ User not found: ${EMAIL}`)
    process.exit(1)
  }

  console.log(`✅ User found`)
  console.log(`   ID: ${user.id}`)
  console.log(`   Email: ${user.email}`)
  console.log(`   Created: ${user.created_at}\n`)

  // Check Personal organization
  const { data: orgs } = await supabase
    .from('organizations')
    .select('*')
    .eq('created_by', user.id)
    .eq('name', 'Personal')
    .is('deleted_at', null)

  if (orgs && orgs.length > 0) {
    console.log(`✅ Personal Organization:`)
    console.log(`   ID: ${orgs[0].id}`)
    console.log(`   Name: ${orgs[0].name}`)
  } else {
    console.log(`❌ No Personal Organization found`)
  }

  // Check organization membership
  const { data: memberships } = await supabase
    .from('organization_members')
    .select(`
      *,
      organization:org_id(name)
    `)
    .eq('user_id', user.id)
    .is('deleted_at', null)

  console.log(`\n📋 Organization Memberships: ${memberships?.length || 0}`)
  memberships?.forEach(m => {
    console.log(`   - ${(m.organization as any)?.name} (${m.org_id})`)
  })

  // Check role assignments
  const { data: roles } = await supabase
    .from('principal_role_assignments')
    .select(`
      *,
      role:role_id(name, description),
      organization:org_id(name)
    `)
    .eq('principal_id', user.id)
    .eq('principal_kind', 'user')
    .is('deleted_at', null)

  console.log(`\n🔐 Role Assignments: ${roles?.length || 0}`)
  roles?.forEach(r => {
    const scope = r.workspace_id ? 'workspace-level' : 'org-level'
    console.log(`   - ${(r.role as any)?.name} (${scope}) in ${(r.organization as any)?.name}`)
  })

  // Summary
  console.log(`\n📊 Summary:`)
  console.log(`   Organizations: ${orgs?.length || 0}`)
  console.log(`   Memberships: ${memberships?.length || 0}`)
  console.log(`   Role Assignments: ${roles?.length || 0}`)

  if (orgs && orgs.length > 0 && memberships && memberships.length > 0 && roles && roles.length > 0) {
    console.log(`\n✅ User RBAC setup looks good!`)
  } else {
    console.log(`\n⚠️  User RBAC setup incomplete!`)
    if (!orgs || orgs.length === 0) console.log(`   - Missing Personal organization`)
    if (!memberships || memberships.length === 0) console.log(`   - Not in organization_members table`)
    if (!roles || roles.length === 0) console.log(`   - No role assignments`)
  }
}

checkUser().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
