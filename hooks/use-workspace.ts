'use client'

import { useOrganizationWorkspaceRequired } from '@/components/providers/organization-workspace-provider'
import { useUser } from './use-user'

export function useWorkspace() {
  const { user, loading: userLoading } = useUser()
  const { organization, workspace } = useOrganizationWorkspaceRequired()

  return {
    user,
    organization,
    workspace,
    loading: userLoading,
  }
}
