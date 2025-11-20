'use server'

import { createClient } from '@/lib/supabase/server'
import { OnboardingService } from '@/lib/services/onboarding-service'
import type {
  OrganizationWithPermission,
  WorkspaceWithPermission,
  OrganizationMembershipStatus,
} from '@/lib/services/onboarding-service'
import { revalidatePath } from 'next/cache'

/**
 * Create an organization and assign Owner role to the current user
 */
export async function createOrganizationWithPermissions(
  name: string
): Promise<{
  success: boolean
  data?: OrganizationWithPermission
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Create onboarding service instance
    const onboardingService = new OnboardingService(supabase)

    // Create organization with permissions
    const organization = await onboardingService.createOrganizationWithPermissions({
      name,
      userId: user.id,
    })

    // Revalidate paths
    revalidatePath('/onboarding')
    revalidatePath('/settings')
    revalidatePath(`/organization/${organization.id}`)

    return {
      success: true,
      data: organization,
    }
  } catch (error) {
    console.error('Error creating organization with permissions:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to create organization'
    return { success: false, error: errorMessage }
  }
}

/**
 * Create a workspace and assign Owner role to the current user
 */
export async function createWorkspaceWithPermissions(
  name: string,
  orgId: string
): Promise<{
  success: boolean
  data?: WorkspaceWithPermission
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Create onboarding service instance
    const onboardingService = new OnboardingService(supabase)

    // Create workspace with permissions
    const workspace = await onboardingService.createWorkspaceWithPermissions({
      name,
      orgId,
      userId: user.id,
    })

    // Revalidate paths
    revalidatePath('/onboarding')
    revalidatePath(`/organization/${orgId}`)
    revalidatePath(`/workspace/${workspace.id}`)

    return {
      success: true,
      data: workspace,
    }
  } catch (error) {
    console.error('Error creating workspace with permissions:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to create workspace'
    return { success: false, error: errorMessage }
  }
}

/**
 * Check if the current user has any organization memberships
 */
export async function checkUserOrganizationMembership(): Promise<{
  success: boolean
  data?: OrganizationMembershipStatus
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Create onboarding service instance
    const onboardingService = new OnboardingService(supabase)

    // Check membership
    const membership = await onboardingService.checkUserOrganizationMembership()

    return {
      success: true,
      data: membership,
    }
  } catch (error) {
    console.error('Error checking organization membership:', error)
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to check organization membership'
    return { success: false, error: errorMessage }
  }
}
