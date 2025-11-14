/**
 * Manually provision an invited user
 * Adds them to an organization and creates their workspace
 */

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

const EMAIL = process.argv[2]
const ORG_ID = process.argv[3]

if (!EMAIL || !ORG_ID) {
  console.error('Usage: npx tsx scripts/manually-provision-invited-user.ts <email> <org_id>')
  process.exit(1)
}

async function provisionUser() {
  console.log(`🔧 Provisioning user: ${EMAIL}`)
  console.log(`📍 Organization: ${ORG_ID}\n`)

  // Get user
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === EMAIL)

  if (!user) {
    console.error(`❌ User not found: ${EMAIL}`)
    process.exit(1)
  }

  console.log(`✅ User ID: ${user.id}`)

  // Verify org exists
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', ORG_ID)
    .is('deleted_at', null)
    .single()

  if (orgError || !org) {
    console.error(`❌ Organization not found: ${ORG_ID}`)
    process.exit(1)
  }

  console.log(`✅ Organization: ${org.name}`)

  // Get roles
  const { data: orgMemberRole } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'org_member')
    .is('deleted_at', null)
    .single()

  const { data: workspaceOwnerRole } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'workspace_owner')
    .is('deleted_at', null)
    .single()

  if (!orgMemberRole || !workspaceOwnerRole) {
    console.error('❌ Required roles not found')
    process.exit(1)
  }

  // Add to organization_members
  console.log(`\n👥 Adding to organization...`)
  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      org_id: ORG_ID,
      user_id: user.id,
      created_by: user.id,
      updated_by: user.id,
    })

  if (memberError && memberError.code !== '23505') {
    console.error(`❌ Failed to add to organization: ${memberError.message}`)
    process.exit(1)
  } else if (memberError?.code === '23505') {
    console.log(`ℹ️  Already a member`)
  } else {
    console.log(`✅ Added to organization`)
  }

  // Create workspace
  console.log(`\n💼 Creating workspace...`)
  const workspaceName = `${user.email?.split('@')[0] || 'User'}'s Workspace`

  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({
      name: workspaceName,
      organization_id: ORG_ID,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()

  if (wsError) {
    console.error(`❌ Failed to create workspace: ${wsError.message}`)
    process.exit(1)
  }

  console.log(`✅ Created workspace: ${workspace.name} (${workspace.id})`)

  // Assign org_member role
  console.log(`\n🎭 Assigning roles...`)
  const { error: orgRoleError } = await supabase
    .from('principal_role_assignments')
    .insert({
      principal_kind: 'user',
      principal_id: user.id,
      org_id: ORG_ID,
      workspace_id: null,
      role_id: orgMemberRole.id,
      created_by: user.id,
      updated_by: user.id,
    })

  if (orgRoleError && orgRoleError.code !== '23505') {
    console.error(`⚠️  Failed to assign org_member: ${orgRoleError.message}`)
  } else {
    console.log(`✅ Assigned org_member role`)
  }

  // Assign workspace_owner role
  const { error: wsRoleError } = await supabase
    .from('principal_role_assignments')
    .insert({
      principal_kind: 'user',
      principal_id: user.id,
      org_id: ORG_ID,
      workspace_id: workspace.id,
      role_id: workspaceOwnerRole.id,
      created_by: user.id,
      updated_by: user.id,
    })

  if (wsRoleError && wsRoleError.code !== '23505') {
    console.error(`⚠️  Failed to assign workspace_owner: ${wsRoleError.message}`)
  } else {
    console.log(`✅ Assigned workspace_owner role`)
  }

  // Mark invitation as accepted if exists
  const { data: invitation } = await supabase
    .from('invitations')
    .select('id')
    .eq('email', EMAIL)
    .eq('org_id', ORG_ID)
    .is('deleted_at', null)
    .is('accepted_at', null)
    .single()

  if (invitation) {
    await supabase
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)
    console.log(`✅ Marked invitation as accepted`)
  }

  console.log(`\n🎉 User successfully provisioned!`)
  console.log(`\n📍 Workspace URL: /organization/${ORG_ID}/workspace/${workspace.id}`)
}

provisionUser()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Error:', err)
    process.exit(1)
  })
