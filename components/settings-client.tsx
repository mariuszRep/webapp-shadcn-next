'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { OrganizationManager } from '@/components/organization-manager'
import { MemberManager } from '@/components/member-manager'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { getOrganizationSettings } from '@/lib/actions/settings-actions'
import type { Organization } from '@/lib/types/database'
import type { OrganizationMemberWithUser, Role } from '@/lib/types/rbac'

interface SettingsClientProps {
  organizations: Organization[]
}

export function SettingsClient({ organizations }: SettingsClientProps) {
  const params = useParams()
  const urlOrgId = params?.organizationId as string | undefined
  const urlWorkspaceId = params?.workspaceId as string | undefined

  // Initialize with URL params if available, otherwise null
  const [selectedOrgId, setSelectedOrgId] = React.useState<string | null>(urlOrgId || null)
  const [settingsData, setSettingsData] = React.useState<{
    canManageMembers: boolean
    canManageRoles: boolean
    members?: OrganizationMemberWithUser[]
    availableRoles?: Role[]
    loading: boolean
    error?: string
  }>({
    canManageMembers: false,
    canManageRoles: false,
    loading: false,
  })

  // Update selected org when URL changes
  React.useEffect(() => {
    if (urlOrgId) {
      setSelectedOrgId(urlOrgId)
    }
  }, [urlOrgId])

  // Fetch organization settings when selected org changes
  React.useEffect(() => {
    let cancelled = false

    if (selectedOrgId) {
      setSettingsData(prev => ({ ...prev, loading: true }))

      getOrganizationSettings(selectedOrgId)
        .then(result => {
          if (cancelled) return

          if (result.success) {
            setSettingsData({
              canManageMembers: result.canManageMembers,
              canManageRoles: result.canManageRoles,
              members: result.members,
              availableRoles: result.availableRoles,
              loading: false,
            })
          } else {
            setSettingsData({
              canManageMembers: false,
              canManageRoles: false,
              loading: false,
              error: result.error,
            })
          }
        })
        .catch(error => {
          if (cancelled) return

          console.error('Error fetching settings:', error)
          setSettingsData({
            canManageMembers: false,
            canManageRoles: false,
            loading: false,
            error: 'Failed to load settings',
          })
        })
    } else {
      setSettingsData({
        canManageMembers: false,
        canManageRoles: false,
        loading: false,
      })
    }

    return () => {
      cancelled = true
    }
  }, [selectedOrgId])

  const selectedOrg = organizations.find(org => org.id === selectedOrgId)

  return (
    <div className="space-y-6">
      <Tabs defaultValue="organizations" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="members" disabled={!selectedOrgId || !settingsData.canManageMembers}>
            Members & Roles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organizations" className="space-y-6 mt-6">
          <OrganizationManager
            organizations={organizations}
            selectedOrgId={selectedOrgId || undefined}
            currentWorkspaceId={urlWorkspaceId}
            onSelectOrg={setSelectedOrgId}
          />
        </TabsContent>

        <TabsContent value="members" className="space-y-6 mt-6">
          {selectedOrgId && settingsData.canManageMembers ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">
                  Members & Roles
                </h2>
                <p className="text-muted-foreground mt-1">
                  Manage members and role assignments for {selectedOrg?.name || 'this organization'}
                </p>
              </div>

              {settingsData.loading ? (
                <Card className="p-6">
                  <p className="text-muted-foreground">Loading...</p>
                </Card>
              ) : settingsData.error ? (
                <Card className="p-6 border-destructive bg-destructive/10">
                  <p className="text-sm text-destructive">{settingsData.error}</p>
                </Card>
              ) : (
                <MemberManager
                  orgId={selectedOrgId}
                  members={settingsData.members || []}
                />
              )}
            </div>
          ) : (
            <Card className="p-6">
              <p className="text-muted-foreground text-center">
                Select an organization to manage members
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
