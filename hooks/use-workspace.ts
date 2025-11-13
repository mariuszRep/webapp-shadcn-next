'use client'

import { useOrganizationWorkspace } from '@/components/providers/organization-workspace-provider'
import { useUser } from './use-user'

export function useWorkspace() {
  const { user, loading: userLoading } = useUser()
  const { organization, workspace } = useOrganizationWorkspace()

  return {
    user,
    organization,
    workspace,
    loading: userLoading,
  }
}
