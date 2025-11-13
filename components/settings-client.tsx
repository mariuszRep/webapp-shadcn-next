'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { OrganizationManager } from '@/components/organization-manager'
import type { Organization } from '@/lib/types/database'

interface SettingsClientProps {
  organizations: Organization[]
}

export function SettingsClient({ organizations }: SettingsClientProps) {
  const params = useParams()
  const urlOrgId = params?.organizationId as string | undefined
  const urlWorkspaceId = params?.workspaceId as string | undefined

  // Initialize with URL params if available, otherwise null
  const [selectedOrgId, setSelectedOrgId] = React.useState<string | null>(urlOrgId || null)

  // Update selected org when URL changes
  React.useEffect(() => {
    if (urlOrgId) {
      setSelectedOrgId(urlOrgId)
    }
  }, [urlOrgId])

  return (
    <div className="space-y-6">
      <OrganizationManager
        organizations={organizations}
        selectedOrgId={selectedOrgId || undefined}
        currentWorkspaceId={urlWorkspaceId}
        onSelectOrg={setSelectedOrgId}
      />
    </div>
  )
}
