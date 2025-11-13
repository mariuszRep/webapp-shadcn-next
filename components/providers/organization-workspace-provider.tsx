'use client'

import { createContext, ReactNode, useContext } from 'react'
import type { Organization, Workspace } from '@/lib/types/database'

interface OrganizationWorkspaceContextValue {
  organization: Organization
  workspace: Workspace
}

const OrganizationWorkspaceContext = createContext<OrganizationWorkspaceContextValue | null>(null)

interface OrganizationWorkspaceProviderProps {
  children: ReactNode
  organization: Organization
  workspace: Workspace
}

export function OrganizationWorkspaceProvider({
  children,
  organization,
  workspace,
}: OrganizationWorkspaceProviderProps) {
  return (
    <OrganizationWorkspaceContext.Provider value={{ organization, workspace }}>
      {children}
    </OrganizationWorkspaceContext.Provider>
  )
}

export function useOrganizationWorkspace() {
  const context = useContext(OrganizationWorkspaceContext)

  if (!context) {
    throw new Error('useOrganizationWorkspace must be used within OrganizationWorkspaceProvider')
  }

  return context
}
