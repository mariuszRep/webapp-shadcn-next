/**
 * Fix user who was incorrectly provisioned with Personal org
 * Moves them to the organization they were invited to
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

if (!EMAIL) {
  console.error('Usage: npx tsx scripts/fix-incorrectly-provisioned-user.ts <email>')
  process.exit(1)
}

async function fixUser() {
  console.log(`🔧 Fixing incorrectly provisioned user: ${EMAIL}\n`)

  // Get user
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === EMAIL)

  if (!user) {
    console.error(`❌ User not found: ${EMAIL}`)
    process.exit(1)
  }

  console.log(`✅ User ID: ${user.id}`)

  // Check for pending invitation
  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, org_id, organization:org_id(name)')
    .eq('email', EMAIL)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!invitation) {
    console.error(`❌ No invitation found for ${EMAIL}`)
    process.exit(1)
  }

  const org = invitation.organization as any
  console.log(`✅ Found invitation to: ${org.name} (${invitation.org_id})`)

  // Get their incorrect Personal organization
  const { data: personalOrg } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('created_by', user.id)
    .eq('name', 'Personal')
    .is('deleted_at', null)
    .single()

  if (personalOrg) {
    console.log(`\n🗑️  Deleting incorrect Personal organization: ${personalOrg.id}`)

    // Soft delete Personal org (cascade will handle workspace, members, roles)
    const { error: deleteOrgError } = await supabase
      .from('organizations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', personalOrg.id)

    if (deleteOrgError) {
      console.error(`⚠️  Failed to delete Personal org: ${deleteOrgError.message}`)
    } else {
      console.log(`✅ Deleted Personal organization`)
    }
  }

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

  // Create workspace in invited organization
  const workspaceName = `${user.email?.split('@')[0] || 'User'}'s Workspace`

  console.log(`\n💼 Creating workspace in invited organization...`)
  const { data: newWorkspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({
      name: workspaceName,
      organization_id: invitation.org_id,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()

  if (wsError) {
    console.error(`❌ Failed to create workspace: ${wsError.message}`)
    process.exit(1)
  }

  console.log(`✅ Created workspace: ${newWorkspace.id}`)

  // Add to organization_members
  console.log(`\n👥 Adding to organization members...`)
  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      org_id: invitation.org_id,
      user_id: user.id,
      created_by: user.id,
      updated_by: user.id,
    })

  if (memberError && memberError.code !== '23505') {
    console.error(`⚠️  Failed to add to organization_members: ${memberError.message}`)
  } else {
    console.log(`✅ Added to organization_members`)
  }

  // Assign org_member role
  console.log(`\n🎭 Assigning roles...`)
  const { error: orgRoleError } = await supabase
    .from('principal_role_assignments')
    .insert({
      principal_kind: 'user',
      principal_id: user.id,
      org_id: invitation.org_id,
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
      org_id: invitation.org_id,
      workspace_id: newWorkspace.id,
      role_id: workspaceOwnerRole.id,
      created_by: user.id,
      updated_by: user.id,
    })

  if (wsRoleError && wsRoleError.code !== '23505') {
    console.error(`⚠️  Failed to assign workspace_owner: ${wsRoleError.message}`)
  } else {
    console.log(`✅ Assigned workspace_owner role`)
  }

  // Mark invitation as accepted
  await supabase
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  console.log(`\n🎉 User fixed and correctly provisioned!`)
}

fixUser()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Error:', err)
    process.exit(1)
  })
