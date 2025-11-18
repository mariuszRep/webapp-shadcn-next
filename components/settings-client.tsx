'use client'

import * as React from 'react'
import { Folder, Shield } from 'lucide-react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { SettingsSidebar, type SettingsSection } from '@/components/settings-sidebar'
import { WorkspaceManager } from '@/components/workspace-manager'
import { PermissionManager } from '@/components/permission-manager'
import { getUserOrganizations } from '@/lib/actions/organization-actions'
import type { Organization } from '@/lib/types/database'

interface SettingsClientProps {
  organizations: Organization[]
  user: {
    name: string
    email: string
    avatar: string
  }
}

export function SettingsClient({ organizations: initialOrganizations, user }: SettingsClientProps) {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlOrgId = params?.organizationId as string | undefined

  const sectionParam = searchParams?.get('section') as SettingsSection | null
  const initialSection: SettingsSection = sectionParam === 'permissions' ? 'permissions' : 'workspaces'

  const [activeSection, setActiveSection] = React.useState<SettingsSection>(initialSection)
  const [organizations, setOrganizations] = React.useState<Organization[]>(initialOrganizations)
  const [selectedOrgId, setSelectedOrgId] = React.useState<string | null>(
    urlOrgId || (initialOrganizations.length > 0 ? initialOrganizations[0].id : null)
  )

  const selectedOrg = organizations.find(org => org.id === selectedOrgId)

  React.useEffect(() => {
    if (urlOrgId) {
      setSelectedOrgId(urlOrgId)
    }
  }, [urlOrgId])

  React.useEffect(() => {
    setOrganizations(initialOrganizations)
    setSelectedOrgId((prev) => {
      if (prev && initialOrganizations.some((org) => org.id === prev)) {
        return prev
      }
      return initialOrganizations[0]?.id ?? null
    })
  }, [initialOrganizations])

  const handleOrganizationsChange = async () => {
    const result = await getUserOrganizations()
    if (result.success && result.organizations) {
      setOrganizations(result.organizations)
      setSelectedOrgId((prev) => {
        if (prev && result.organizations.some((org) => org.id === prev)) {
          return prev
        }
        return result.organizations[0]?.id ?? null
      })
    }
  }

  const handleSectionChange = (section: SettingsSection) => {
    setActiveSection(section)
    const paramsCopy = new URLSearchParams(searchParams?.toString() || '')
    paramsCopy.set('section', section)
    const queryString = paramsCopy.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
  }

  const renderEmptyState = (title: string, description: string, icon: 'workspaces' | 'permissions') => {
    const Icon = icon === 'workspaces' ? Folder : Shield
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-10 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/5">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground mt-2 text-sm max-w-sm">{description}</p>
        <p className="text-muted-foreground mt-4 text-xs">
          Use the organization switcher to select an organization.
        </p>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <SettingsSidebar
        organizations={organizations}
        selectedOrgId={selectedOrgId}
        onSelectOrg={setSelectedOrgId}
        onOrganizationsChange={handleOrganizationsChange}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        user={user}
        navigationDisabled={!selectedOrgId}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-6" />
          <div>
            <p className="text-sm text-muted-foreground">Organization Settings</p>
            <h1 className="text-lg font-semibold leading-6">
              {selectedOrg?.name || 'Select an organization'}
            </h1>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
          {activeSection === 'workspaces' ? (
            selectedOrgId && selectedOrg ? (
              <WorkspaceManager
                organizationId={selectedOrgId}
                organizationName={selectedOrg.name}
              />
            ) : (
              renderEmptyState(
                'Select an organization to manage workspaces',
                'Choose an organization from the sidebar to create, edit, or remove workspaces.',
                'workspaces'
              )
            )
          ) : selectedOrgId ? (
            <PermissionManager orgId={selectedOrgId} />
          ) : (
            renderEmptyState(
              'Select an organization to manage permissions',
              'Pick an organization from the sidebar to view and update member access.',
              'permissions'
            )
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
