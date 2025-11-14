/**
 * Migration Script: Assign RBAC roles to existing users
 *
 * This script:
 * 1. Queries all organizations and assigns org_owner role to creators
 * 2. Queries all workspaces and assigns workspace_owner role to creators
 * 3. Adds users to organization_members if not already added
 *
 * Usage:
 *   SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/migrate-to-rbac.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Read environment variables from .env.local
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local')
    const envContent = readFileSync(envPath, 'utf-8')
    const envVars: Record<string, string> = {}

    envContent.split('\n').forEach(line => {
      const [key, ...values] = line.split('=')
      if (key && values.length) {
        envVars[key.trim()] = values.join('=').trim()
      }
    })

    return envVars
  } catch (error) {
    console.error('Error loading .env.local file:', error)
    return {}
  }
}

async function migrateToRBAC() {
  // Load environment variables
  const env = loadEnv()
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  }

  console.log('🚀 Starting RBAC migration...\n')
  console.log(`📍 Supabase URL: ${supabaseUrl}\n`)

  // Create Supabase client with service role key (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    // Step 1: Fetch all roles
    console.log('📋 Step 1: Fetching roles...')
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('id, name')
      .is('deleted_at', null)

    if (rolesError) {
      throw new Error(`Failed to fetch roles: ${rolesError.message}`)
    }

    const orgOwnerRole = roles?.find(r => r.name === 'org_owner')
    const workspaceOwnerRole = roles?.find(r => r.name === 'workspace_owner')

    if (!orgOwnerRole) {
      throw new Error('org_owner role not found. Please run migrations first.')
    }

    if (!workspaceOwnerRole) {
      throw new Error('workspace_owner role not found. Please run migrations first.')
    }

    console.log(`✅ Found org_owner role: ${orgOwnerRole.id}`)
    console.log(`✅ Found workspace_owner role: ${workspaceOwnerRole.id}\n`)

    // Step 2: Fetch all organizations
    console.log('📋 Step 2: Fetching organizations...')
    const { data: organizations, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name, created_by')
      .is('deleted_at', null)

    if (orgsError) {
      throw new Error(`Failed to fetch organizations: ${orgsError.message}`)
    }

    console.log(`✅ Found ${organizations?.length || 0} organizations\n`)

    // Step 3: Process organizations
    console.log('📋 Step 3: Processing organizations...')
    let orgMembersAdded = 0
    let orgOwnersAssigned = 0

    for (const org of organizations || []) {
      console.log(`  Processing org: ${org.name} (${org.id})`)

      // Add creator to organization_members
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          org_id: org.id,
          user_id: org.created_by,
          created_by: org.created_by,
          updated_by: org.created_by,
        })
        .select()
        .single()

      // Ignore duplicate errors (23505 is PostgreSQL unique violation)
      if (memberError && memberError.code !== '23505') {
        console.error(`    ⚠️  Failed to add member: ${memberError.message}`)
      } else if (!memberError) {
        orgMembersAdded++
        console.log(`    ✅ Added member`)
      } else {
        console.log(`    ℹ️  Member already exists`)
      }

      // Assign org_owner role
      const { error: roleError } = await supabase
        .from('principal_role_assignments')
        .insert({
          principal_kind: 'user',
          principal_id: org.created_by,
          org_id: org.id,
          workspace_id: null,
          role_id: orgOwnerRole.id,
          created_by: org.created_by,
          updated_by: org.created_by,
        })
        .select()
        .single()

      if (roleError && roleError.code !== '23505') {
        console.error(`    ⚠️  Failed to assign org_owner: ${roleError.message}`)
      } else if (!roleError) {
        orgOwnersAssigned++
        console.log(`    ✅ Assigned org_owner role`)
      } else {
        console.log(`    ℹ️  org_owner role already assigned`)
      }
    }

    console.log(`\n✅ Added ${orgMembersAdded} new organization members`)
    console.log(`✅ Assigned ${orgOwnersAssigned} new org_owner roles\n`)

    // Step 4: Fetch all workspaces
    console.log('📋 Step 4: Fetching workspaces...')
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .select('id, name, organization_id, created_by')
      .is('deleted_at', null)

    if (workspacesError) {
      throw new Error(`Failed to fetch workspaces: ${workspacesError.message}`)
    }

    console.log(`✅ Found ${workspaces?.length || 0} workspaces\n`)

    // Step 5: Process workspaces
    console.log('📋 Step 5: Processing workspaces...')
    let workspaceOwnersAssigned = 0

    for (const workspace of workspaces || []) {
      console.log(`  Processing workspace: ${workspace.name} (${workspace.id})`)

      // Assign workspace_owner role
      const { error: roleError } = await supabase
        .from('principal_role_assignments')
        .insert({
          principal_kind: 'user',
          principal_id: workspace.created_by,
          org_id: workspace.organization_id,
          workspace_id: workspace.id,
          role_id: workspaceOwnerRole.id,
          created_by: workspace.created_by,
          updated_by: workspace.created_by,
        })
        .select()
        .single()

      if (roleError && roleError.code !== '23505') {
        console.error(`    ⚠️  Failed to assign workspace_owner: ${roleError.message}`)
      } else if (!roleError) {
        workspaceOwnersAssigned++
        console.log(`    ✅ Assigned workspace_owner role`)
      } else {
        console.log(`    ℹ️  workspace_owner role already assigned`)
      }
    }

    console.log(`\n✅ Assigned ${workspaceOwnersAssigned} new workspace_owner roles\n`)

    // Summary
    console.log('🎉 Migration Complete!\n')
    console.log('Summary:')
    console.log(`  • Organizations processed: ${organizations?.length || 0}`)
    console.log(`  • Organization members added: ${orgMembersAdded}`)
    console.log(`  • org_owner roles assigned: ${orgOwnersAssigned}`)
    console.log(`  • Workspaces processed: ${workspaces?.length || 0}`)
    console.log(`  • workspace_owner roles assigned: ${workspaceOwnersAssigned}`)
    console.log('\n✨ All users have been migrated to the RBAC system!')

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run migration
migrateToRBAC()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
