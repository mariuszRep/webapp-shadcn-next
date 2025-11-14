/**
 * Fix Missing Personal Organizations
 *
 * This script creates Personal organizations and workspaces for users who don't have them.
 * Run this after updating the auto-provision trigger to fix existing users.
 *
 * Usage:
 *   npx tsx scripts/fix-missing-personal-orgs.ts
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

async function fixMissingPersonalOrgs() {
  const env = loadEnv()
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  }

  console.log('🔧 Fixing missing Personal organizations...\n')

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    // Get all users from auth.users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`)
    }

    console.log(`Found ${users.length} total users\n`)

    // Get role IDs
    const { data: orgOwnerRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'org_owner')
      .is('deleted_at', null)
      .single()

    const { data: workspaceOwnerRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'workspace_owner')
      .is('deleted_at', null)
      .single()

    if (!orgOwnerRole || !workspaceOwnerRole) {
      throw new Error('Required roles not found. Please run migrations first.')
    }

    let fixed = 0
    let skipped = 0

    for (const user of users) {
      console.log(`Checking user: ${user.email || user.id}`)

      // Check if user has Personal organization
      const { data: personalOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('created_by', user.id)
        .eq('name', 'Personal')
        .is('deleted_at', null)
        .single()

      if (personalOrg) {
        console.log('  ✓ Already has Personal organization\n')
        skipped++
        continue
      }

      // Create Personal organization
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: 'Personal',
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single()

      if (orgError) {
        console.error(`  ✗ Failed to create organization: ${orgError.message}\n`)
        continue
      }

      console.log(`  ✓ Created Personal organization: ${newOrg.id}`)

      // Create Personal workspace
      const { data: newWorkspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert({
          name: 'Personal',
          organization_id: newOrg.id,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single()

      if (workspaceError) {
        console.error(`  ✗ Failed to create workspace: ${workspaceError.message}\n`)
        continue
      }

      console.log(`  ✓ Created Personal workspace: ${newWorkspace.id}`)

      // Add to organization_members
      await supabase
        .from('organization_members')
        .insert({
          org_id: newOrg.id,
          user_id: user.id,
          created_by: user.id,
          updated_by: user.id,
        })

      console.log(`  ✓ Added to organization_members`)

      // Assign org_owner role
      await supabase
        .from('principal_role_assignments')
        .insert({
          principal_kind: 'user',
          principal_id: user.id,
          org_id: newOrg.id,
          workspace_id: null,
          role_id: orgOwnerRole.id,
          created_by: user.id,
          updated_by: user.id,
        })

      console.log(`  ✓ Assigned org_owner role`)

      // Assign workspace_owner role
      await supabase
        .from('principal_role_assignments')
        .insert({
          principal_kind: 'user',
          principal_id: user.id,
          org_id: newOrg.id,
          workspace_id: newWorkspace.id,
          role_id: workspaceOwnerRole.id,
          created_by: user.id,
          updated_by: user.id,
        })

      console.log(`  ✓ Assigned workspace_owner role\n`)

      fixed++
    }

    console.log('🎉 Fix Complete!\n')
    console.log(`Summary:`)
    console.log(`  • Total users: ${users.length}`)
    console.log(`  • Fixed: ${fixed}`)
    console.log(`  • Skipped (already had Personal org): ${skipped}`)

  } catch (error) {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  }
}

fixMissingPersonalOrgs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
