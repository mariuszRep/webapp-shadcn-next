'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Folder, Shield } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OrganizationSwitcher } from '@/components/organization-switcher'
import { WorkspaceManager } from '@/components/workspace-manager'
import { PermissionManager } from '@/components/permission-manager'
import { getUserOrganizations } from '@/lib/actions/organization-actions'
import type { Organization } from '@/lib/types/database'

interface SettingsClientProps {
  organizations: Organization[]
}

export function SettingsClient({ organizations: initialOrganizations }: SettingsClientProps) {
  const params = useParams()
  const router = useRouter()
  const urlOrgId = params?.organizationId as string | undefined

  const [organizations, setOrganizations] = React.useState<Organization[]>(initialOrganizations)
  const [selectedOrgId, setSelectedOrgId] = React.useState<string | null>(
    urlOrgId || (initialOrganizations.length > 0 ? initialOrganizations[0].id : null)
  )

  const selectedOrg = organizations.find(org => org.id === selectedOrgId)

  // Update selected org when URL changes
  React.useEffect(() => {
    if (urlOrgId) {
      setSelectedOrgId(urlOrgId)
    }
  }, [urlOrgId])

  // Refresh organizations list
  const handleOrganizationsChange = async () => {
    const result = await getUserOrganizations()
    if (result.success && result.organizations) {
      setOrganizations(result.organizations)

      // If current selected org was deleted, select first available
      if (selectedOrgId && !result.organizations.find(org => org.id === selectedOrgId)) {
        if (result.organizations.length > 0) {
          setSelectedOrgId(result.organizations[0].id)
        } else {
          setSelectedOrgId(null)
        }
      }

      // If no org selected and we have orgs, select first
      if (!selectedOrgId && result.organizations.length > 0) {
        setSelectedOrgId(result.organizations[0].id)
      }
    }
  }

  return (
    <div className="space-y-6">
      <OrganizationSwitcher
        organizations={organizations}
        selectedOrgId={selectedOrgId}
        onSelectOrg={setSelectedOrgId}
        onOrganizationsChange={handleOrganizationsChange}
      />

      <Tabs defaultValue="workspaces" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="workspaces" className="flex items-center gap-2" disabled={!selectedOrgId}>
            <Folder className="h-4 w-4" />
            Workspaces
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2" disabled={!selectedOrgId}>
            <Shield className="h-4 w-4" />
            Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workspaces" className="mt-6">
          {selectedOrgId && selectedOrg ? (
            <WorkspaceManager
              organizationId={selectedOrgId}
              organizationName={selectedOrg.name}
            />
          ) : (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Please select an organization to manage workspaces
            </div>
          )}
        </TabsContent>

        <TabsContent value="permissions" className="mt-6">
          {selectedOrgId ? (
            <PermissionManager orgId={selectedOrgId} />
          ) : (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Please select an organization to manage permissions
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
