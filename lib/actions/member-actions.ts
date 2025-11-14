'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/utils/permissions'
import type { OrganizationMemberWithUser } from '@/lib/types/rbac'

/**
 * Invite a user to an organization
 */
export async function inviteOrgMember(
  orgId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate email
    if (!email || !email.includes('@')) {
      return { success: false, error: 'Valid email is required' }
    }

    // Check permission to manage members
    await requirePermission('organization', 'manage_members', orgId)

    // Create admin client for invite operation
    const adminClient = createAdminClient()

    // Create invitation record first (so trigger can find it)
    const { error: invitationError } = await adminClient
      .from('invitations')
      .insert({
        email,
        org_id: orgId,
        invited_by: user.id,
      })

    if (invitationError && invitationError.code !== '23505') {
      console.error('Error creating invitation record:', invitationError)
      return { success: false, error: 'Failed to create invitation' }
    }

    // Get the redirect URL from headers (respects current origin)
    // Point directly to the client-side confirm page to preserve hash tokens
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const redirectUrl = `${origin}/auth/confirm?next=/portal`

    console.log('Sending invitation with redirect URL:', redirectUrl)

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: redirectUrl,
      }
    )

    if (inviteError) {
      console.error('Error inviting user:', inviteError)
      return { success: false, error: `Failed to send invitation: ${inviteError.message}` }
    }

    if (!inviteData.user) {
      return { success: false, error: 'Failed to create user invitation' }
    }

    // Note: Workspace creation, organization membership, and role assignments are now
    // handled automatically by the on_auth_user_created trigger, which checks the
    // invitations table for pending invitations

    // Revalidate settings page
    revalidatePath('/settings')

    return { success: true }
  } catch (error) {
    console.error('Unexpected error inviting member:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Remove a member from an organization
 * This will cascade delete their role assignments
 */
export async function removeOrgMember(
  orgId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Cannot remove self
    if (userId === user.id) {
      return { success: false, error: 'Cannot remove yourself from the organization' }
    }

    // Check permission to manage members
    await requirePermission('organization', 'manage_members', orgId)

    // Delete organization member (cascade will delete role assignments)
    const { error: deleteError } = await supabase
      .from('organization_members')
      .delete()
      .eq('org_id', orgId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error removing organization member:', deleteError)
      return { success: false, error: 'Failed to remove member' }
    }

    // Revalidate settings page
    revalidatePath('/settings')

    return { success: true }
  } catch (error) {
    console.error('Unexpected error removing member:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get all members of an organization
 */
export async function getOrgMembers(
  orgId: string
): Promise<{ success: boolean; members?: OrganizationMemberWithUser[]; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Fetch organization members with user details from view
    const { data, error } = await supabase
      .from('organization_members_with_users')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching organization members:', error)
      return { success: false, error: 'Failed to fetch members' }
    }

    // Transform view data to match expected format
    const members = data?.map(row => ({
      org_id: row.org_id,
      user_id: row.user_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      updated_by: row.updated_by,
      deleted_at: row.deleted_at,
      user: {
        id: row.user_id,
        email: row.user_email,
      },
    }))

    return { success: true, members: members as any }
  } catch (error) {
    console.error('Unexpected error fetching members:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
