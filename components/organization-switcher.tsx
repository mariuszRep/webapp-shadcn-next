'use client'

import * as React from 'react'
import { Building2, ChevronsUpDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { toast } from 'sonner'
import { createOrganization, updateOrganization, deleteOrganization } from '@/lib/actions/organization-actions'
import type { Organization } from '@/lib/types/database'

interface OrganizationSwitcherProps {
  organizations: Organization[]
  selectedOrgId: string | null
  onSelectOrg: (orgId: string) => void
  onOrganizationsChange: () => void
}

export function OrganizationSwitcher({
  organizations,
  selectedOrgId,
  onSelectOrg,
  onOrganizationsChange,
}: OrganizationSwitcherProps) {
  const { isMobile } = useSidebar()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [createMode, setCreateMode] = React.useState(false)
  const [editingOrgId, setEditingOrgId] = React.useState<string | null>(null)
  const [deleteConfirmOrgId, setDeleteConfirmOrgId] = React.useState<string | null>(null)
  const [orgName, setOrgName] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  const selectedOrg = organizations.find(org => org.id === selectedOrgId)

  const closeMenu = () => setMenuOpen(false)

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      toast.error('Organization name is required')
      return
    }

    setLoading(true)
    const result = await createOrganization(orgName)
    setLoading(false)

    if (result.success && result.organization) {
      toast.success('Organization created successfully')
      setOrgName('')
      setCreateMode(false)
      onOrganizationsChange()
      onSelectOrg(result.organization.id)
      closeMenu()
    } else {
      toast.error(result.error || 'Failed to create organization')
    }
  }

  const handleUpdateOrg = async (orgId: string) => {
    if (!orgName.trim()) {
      toast.error('Organization name is required')
      return
    }

    setLoading(true)
    const result = await updateOrganization(orgId, orgName)
    setLoading(false)

    if (result.success) {
      toast.success('Organization updated successfully')
      setOrgName('')
      setEditingOrgId(null)
      onOrganizationsChange()
    } else {
      toast.error(result.error || 'Failed to update organization')
    }
  }

  const handleDeleteOrg = async (orgId: string) => {
    setLoading(true)
    const result = await deleteOrganization(orgId)
    setLoading(false)

    if (result.success) {
      toast.success('Organization deleted successfully')
      setDeleteConfirmOrgId(null)
      onOrganizationsChange()

      // If we deleted the selected org, switch to the first available
      if (selectedOrgId === orgId && organizations.length > 1) {
        const nextOrg = organizations.find(org => org.id !== orgId)
        if (nextOrg) {
          onSelectOrg(nextOrg.id)
        }
      }
    } else {
      toast.error(result.error || 'Failed to delete organization')
    }
  }

  const handleSelectOrg = (orgId: string) => {
    if (orgId === selectedOrgId) {
      closeMenu()
      return
    }

    onSelectOrg(orgId)
    closeMenu()
    toast.success('Organization switched successfully')
  }

  const startEdit = (org: Organization) => {
    setEditingOrgId(org.id)
    setOrgName(org.name)
    setCreateMode(false)
  }

  const cancelEdit = () => {
    setEditingOrgId(null)
    setOrgName('')
  }

  const startCreate = () => {
    setCreateMode(true)
    setEditingOrgId(null)
    setOrgName('')
  }

  const cancelCreate = () => {
    setCreateMode(false)
    setOrgName('')
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-lg">
                  <Building2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {selectedOrg?.name || 'Select an organization'}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">Organization</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-72 rounded-lg p-0"
              sideOffset={4}
              align="start"
              side={isMobile ? 'bottom' : 'right'}
            >
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Manage Organizations
              </DropdownMenuLabel>
              <div className="space-y-3 p-3">
                {createMode ? (
                  <div className="space-y-3 rounded-lg border p-3">
                    <div className="space-y-2">
                      <Label htmlFor="new-org-name">Organization Name</Label>
                      <Input
                        id="new-org-name"
                        value={orgName}
                        autoFocus
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="Enter organization name"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCreateOrg()
                          }
                        }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleCreateOrg} disabled={loading} size="sm">
                        Create
                      </Button>
                      <Button onClick={cancelCreate} variant="outline" size="sm">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={startCreate}
                    variant="outline"
                    size="sm"
                    className="w-full justify-center"
                  >
                    <Plus className="mr-2 size-4" />
                    Create New Organization
                  </Button>
                )}

                <Separator />

                <div className="space-y-2">
                  {organizations.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground">
                      No organizations yet. Create your first one to get started.
                    </p>
                  ) : (
                    organizations.map((org) => (
                      <div key={org.id}>
                        {editingOrgId === org.id ? (
                          <div className="space-y-3 rounded-lg border p-3">
                            <div className="space-y-2">
                              <Label htmlFor={`edit-org-${org.id}`}>Organization Name</Label>
                              <Input
                                id={`edit-org-${org.id}`}
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                placeholder="Enter organization name"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateOrg(org.id)
                                  }
                                }}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={() => handleUpdateOrg(org.id)} disabled={loading} size="sm">
                                Save
                              </Button>
                              <Button onClick={cancelEdit} variant="outline" size="sm">
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent">
                            <button
                              className="flex-1 text-left"
                              onClick={() => handleSelectOrg(org.id)}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{org.name}</span>
                                {selectedOrgId === org.id && (
                                  <span className="text-xs text-muted-foreground">Current</span>
                                )}
                              </div>
                            </button>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  startEdit(org)
                                }}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setDeleteConfirmOrgId(org.id)
                                }}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
              <DropdownMenuSeparator />
              <p className="px-3 pb-3 text-center text-xs text-muted-foreground">
                Select an organization to manage settings
              </p>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmOrgId} onOpenChange={() => setDeleteConfirmOrgId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this organization and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmOrgId) {
                  handleDeleteOrg(deleteConfirmOrgId)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
