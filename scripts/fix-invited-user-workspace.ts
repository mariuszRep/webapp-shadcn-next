/**
 * Fix invited user workspace access
 * Creates a personal workspace in organizations they were invited to
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
  console.error('Usage: npx tsx scripts/fix-invited-user-workspace.ts <email>')
  process.exit(1)
}

async function fixInvitedUser() {
  console.log(`🔧 Fixing workspace access for: ${EMAIL}\n`)

  // Get user
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === EMAIL)

  if (!user) {
    console.error(`❌ User not found: ${EMAIL}`)
    process.exit(1)
  }

  console.log(`✅ User ID: ${user.id}\n`)

  // Get workspace_owner role
  const { data: workspaceOwnerRole } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'workspace_owner')
    .is('deleted_at', null)
    .single()

  if (!workspaceOwnerRole) {
    throw new Error('workspace_owner role not found')
  }

  // Find organizations where user is a member
  const { data: memberships } = await supabase
    .from('organization_members')
    .select(`
      org_id,
      organization:org_id(id, name, created_by)
    `)
    .eq('user_id', user.id)
    .is('deleted_at', null)

  if (!memberships || memberships.length === 0) {
    console.error('❌ User is not a member of any organization')
    process.exit(1)
  }

  console.log(`📋 Found ${memberships.length} organization memberships\n`)

  let fixed = 0

  for (const membership of memberships) {
    const org = membership.organization as any

    // Skip if this is their own Personal organization
    if (org.created_by === user.id && org.name === 'Personal') {
      console.log(`⏭️  Skipping own Personal organization: ${org.name}`)
      continue
    }

    console.log(`Checking organization: ${org.name} (${org.id})`)

    // Check if user has a workspace in this org
    const { data: existingWorkspaces } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('organization_id', org.id)
      .eq('created_by', user.id)
      .is('deleted_at', null)

    if (existingWorkspaces && existingWorkspaces.length > 0) {
      console.log(`  ✓ Already has workspace: ${existingWorkspaces[0].name}`)

      // Check if they have workspace_owner role
      const { data: roleAssignment } = await supabase
        .from('principal_role_assignments')
        .select('id')
        .eq('principal_id', user.id)
        .eq('org_id', org.id)
        .eq('workspace_id', existingWorkspaces[0].id)
        .eq('role_id', workspaceOwnerRole.id)
        .is('deleted_at', null)
        .single()

      if (!roleAssignment) {
        // Assign workspace_owner role
        await supabase
          .from('principal_role_assignments')
          .insert({
            principal_kind: 'user',
            principal_id: user.id,
            org_id: org.id,
            workspace_id: existingWorkspaces[0].id,
            role_id: workspaceOwnerRole.id,
            created_by: user.id,
            updated_by: user.id,
          })
        console.log(`  ✅ Assigned workspace_owner role`)
        fixed++
      }

      continue
    }

    // Create workspace for user in this org
    const workspaceName = `${user.email?.split('@')[0] || 'User'}'s Workspace`

    const { data: newWorkspace, error: wsError } = await supabase
      .from('workspaces')
      .insert({
        name: workspaceName,
        organization_id: org.id,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (wsError) {
      console.error(`  ❌ Failed to create workspace: ${wsError.message}`)
      continue
    }

    console.log(`  ✅ Created workspace: ${newWorkspace.id}`)

    // Assign workspace_owner role
    const { error: roleError } = await supabase
      .from('principal_role_assignments')
      .insert({
        principal_kind: 'user',
        principal_id: user.id,
        org_id: org.id,
        workspace_id: newWorkspace.id,
        role_id: workspaceOwnerRole.id,
        created_by: user.id,
        updated_by: user.id,
      })

    if (roleError) {
      console.error(`  ❌ Failed to assign workspace_owner role: ${roleError.message}`)
    } else {
      console.log(`  ✅ Assigned workspace_owner role`)
      fixed++
    }
  }

  console.log(`\n🎉 Fixed ${fixed} workspace access issues!`)
}

fixInvitedUser()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Error:', err)
    process.exit(1)
  })
