'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Edit2, Plus, Trash2 } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { Organization, Workspace } from '@/lib/types/database'
import { createOrganization, updateOrganization, deleteOrganization } from '@/lib/actions/organization-actions'
import { createWorkspace, updateWorkspace, deleteWorkspace, getOrganizationWorkspaces } from '@/lib/actions/workspace-actions'

interface OrganizationManagerProps {
  organizations: Organization[]
  selectedOrgId?: string
  currentWorkspaceId?: string
  onSelectOrg?: (orgId: string | null) => void
}

export function OrganizationManager({ organizations, selectedOrgId, currentWorkspaceId, onSelectOrg }: OrganizationManagerProps) {
  const router = useRouter()

  // Organization state
  const [isCreateOrgDialogOpen, setIsCreateOrgDialogOpen] = React.useState(false)
  const [isEditOrgDialogOpen, setIsEditOrgDialogOpen] = React.useState(false)
  const [isDeleteOrgDialogOpen, setIsDeleteOrgDialogOpen] = React.useState(false)
  const [editOrg, setEditOrg] = React.useState<Organization | null>(null)
  const [deleteOrg, setDeleteOrg] = React.useState<Organization | null>(null)
  const [organizationName, setOrganizationName] = React.useState('')

  // Workspace state
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([])
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = React.useState(false)
  const [isCreateWorkspaceDialogOpen, setIsCreateWorkspaceDialogOpen] = React.useState(false)
  const [isEditWorkspaceDialogOpen, setIsEditWorkspaceDialogOpen] = React.useState(false)
  const [isDeleteWorkspaceDialogOpen, setIsDeleteWorkspaceDialogOpen] = React.useState(false)
  const [editWorkspace, setEditWorkspace] = React.useState<Workspace | null>(null)
  const [deleteWorkspace, setDeleteWorkspace] = React.useState<Workspace | null>(null)
  const [workspaceName, setWorkspaceName] = React.useState('')

  const [isPending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  const selectedOrg = organizations.find((org) => org.id === selectedOrgId)

  // Load workspaces when organization changes
  React.useEffect(() => {
    async function loadWorkspaces() {
      if (!selectedOrgId) {
        setWorkspaces([])
        return
      }

      setIsLoadingWorkspaces(true)
      const result = await getOrganizationWorkspaces(selectedOrgId)

      if (result.success && result.workspaces) {
        setWorkspaces(result.workspaces)
      } else {
        setError(result.error || 'Failed to load workspaces')
      }

      setIsLoadingWorkspaces(false)
    }

    loadWorkspaces()
  }, [selectedOrgId])

  const refreshWorkspaces = async () => {
    if (!selectedOrgId) return

    const result = await getOrganizationWorkspaces(selectedOrgId)

    if (result.success && result.workspaces) {
      setWorkspaces(result.workspaces)
    }
  }

  const handleCreateOrganization = () => {
    if (!organizationName.trim()) {
      setError('Organization name is required')
      return
    }

    setError(null)

    startTransition(async () => {
      const result = await createOrganization(organizationName)

      if (result.success) {
        setIsCreateOrgDialogOpen(false)
        setOrganizationName('')
        router.refresh()
      } else {
        setError(result.error || 'Failed to create organization')
      }
    })
  }

  const handleEditOrganization = () => {
    if (!editOrg) return

    if (!organizationName.trim()) {
      setError('Organization name is required')
      return
    }

    setError(null)

    startTransition(async () => {
      const result = await updateOrganization(editOrg.id, organizationName)

      if (result.success) {
        setIsEditDialogOpen(false)
        setOrganizationName('')
        setEditOrg(null)
        router.refresh()
      } else {
        setError(result.error || 'Failed to update organization')
      }
    })
  }

  const handleDeleteOrganization = () => {
    if (!deleteOrg) return

    startTransition(async () => {
      const result = await deleteOrganization(deleteOrg.id)

      if (result.success) {
        setIsDeleteOrgDialogOpen(false)
        setDeleteOrg(null)
        // If we deleted the selected org, deselect it
        if (selectedOrgId === deleteOrg.id && onSelectOrg) {
          onSelectOrg(null)
        }
        router.refresh()
      } else {
        setError(result.error || 'Failed to delete organization')
      }
    })
  }

  const handleSelectOrg = (orgId: string) => {
    if (onSelectOrg) {
      onSelectOrg(orgId)
    }
  }

  const openEditOrgDialog = (org: Organization) => {
    setEditOrg(org)
    setOrganizationName(org.name)
    setIsEditOrgDialogOpen(true)
  }

  const openDeleteOrgDialog = (org: Organization) => {
    setDeleteOrg(org)
    setIsDeleteOrgDialogOpen(true)
  }

  // Workspace handlers
  const handleCreateWorkspace = () => {
    if (!selectedOrgId) return

    if (!workspaceName.trim()) {
      setError('Workspace name is required')
      return
    }

    setError(null)

    startTransition(async () => {
      const result = await createWorkspace(selectedOrgId, workspaceName)

      if (result.success) {
        setIsCreateWorkspaceDialogOpen(false)
        setWorkspaceName('')
        await refreshWorkspaces()
      } else {
        setError(result.error || 'Failed to create workspace')
      }
    })
  }

  const handleEditWorkspace = () => {
    if (!editWorkspace) return

    if (!workspaceName.trim()) {
      setError('Workspace name is required')
      return
    }

    setError(null)

    startTransition(async () => {
      const result = await updateWorkspace(editWorkspace.id, workspaceName)

      if (result.success) {
        setIsEditWorkspaceDialogOpen(false)
        setWorkspaceName('')
        setEditWorkspace(null)
        await refreshWorkspaces()
      } else {
        setError(result.error || 'Failed to update workspace')
      }
    })
  }

  const handleDeleteWorkspace = () => {
    if (!deleteWorkspace) return

    startTransition(async () => {
      const result = await deleteWorkspace(deleteWorkspace.id)

      if (result.success) {
        setIsDeleteWorkspaceDialogOpen(false)
        setDeleteWorkspace(null)
        await refreshWorkspaces()
      } else {
        setError(result.error || 'Failed to delete workspace')
      }
    })
  }

  const handleSwitchWorkspace = (workspace: Workspace) => {
    if (!selectedOrgId) return
    router.push(`/organization/${selectedOrgId}/workspace/${workspace.id}`)
  }

  const openEditWorkspaceDialog = (workspace: Workspace) => {
    setEditWorkspace(workspace)
    setWorkspaceName(workspace.name)
    setIsEditWorkspaceDialogOpen(true)
  }

  const openDeleteWorkspaceDialog = (workspace: Workspace) => {
    setDeleteWorkspace(workspace)
    setIsDeleteWorkspaceDialogOpen(true)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Organizations & Workspaces</CardTitle>
              <CardDescription>
                Manage your organizations and workspaces.
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateOrgDialogOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Organization
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          {organizations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">
                No organizations found. Create one to get started.
              </p>
              <Button onClick={() => setIsCreateOrgDialogOpen(true)} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Organization
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Select value={selectedOrgId || ''} onValueChange={handleSelectOrg}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select an organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedOrg && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openEditOrgDialog(selectedOrg)}
                      disabled={isPending}
                      title="Edit organization"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openDeleteOrgDialog(selectedOrg)}
                      disabled={isPending || selectedOrg.name === 'Personal'}
                      title={selectedOrg.name === 'Personal' ? 'Cannot delete personal organization' : 'Delete organization'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              {selectedOrg && (
                <div className="text-sm text-muted-foreground">
                  Created {new Date(selectedOrg.created_at).toLocaleDateString()}
                </div>
              )}

              {/* Workspaces Section */}
              {selectedOrgId && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">Workspaces</h3>
                      <Button onClick={() => setIsCreateWorkspaceDialogOpen(true)} size="sm" variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        New Workspace
                      </Button>
                    </div>
                    {isLoadingWorkspaces ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">Loading workspaces...</p>
                      </div>
                    ) : workspaces.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground mb-3">
                          No workspaces found for this organization.
                        </p>
                        <Button onClick={() => setIsCreateWorkspaceDialogOpen(true)} variant="outline" size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          Create Your First Workspace
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {workspaces.map((workspace) => {
                          const isCurrentWorkspace = currentWorkspaceId === workspace.id
                          return (
                            <div
                              key={workspace.id}
                              className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                                isCurrentWorkspace
                                  ? 'border-primary bg-accent/50'
                                  : 'hover:bg-accent/30'
                              }`}
                            >
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">{workspace.name}</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Created {new Date(workspace.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                {isCurrentWorkspace ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled
                                    className="cursor-default"
                                  >
                                    Current
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSwitchWorkspace(workspace)}
                                    disabled={isPending}
                                  >
                                    Switch
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditWorkspaceDialog(workspace)}
                                  disabled={isPending}
                                  title="Edit workspace"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openDeleteWorkspaceDialog(workspace)}
                                  disabled={isPending || workspace.name === 'Personal'}
                                  title={workspace.name === 'Personal' ? 'Cannot delete personal workspace' : 'Delete workspace'}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Organization Dialog */}
      <Dialog open={isCreateOrgDialogOpen} onOpenChange={setIsCreateOrgDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Add a new organization to manage your workspaces.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-org-name">Organization Name</Label>
              <Input
                id="create-org-name"
                placeholder="My Organization"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isPending) {
                    handleCreateOrganization()
                  }
                }}
                disabled={isPending}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOrgDialogOpen(false)
                setOrganizationName('')
                setError(null)
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateOrganization} disabled={isPending}>
              {isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Dialog */}
      <Dialog open={isEditOrgDialogOpen} onOpenChange={setIsEditOrgDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update the organization name.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-org-name">Organization Name</Label>
              <Input
                id="edit-org-name"
                placeholder="My Organization"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isPending) {
                    handleEditOrganization()
                  }
                }}
                disabled={isPending}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditOrgDialogOpen(false)
                setOrganizationName('')
                setEditOrg(null)
                setError(null)
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleEditOrganization} disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Organization Confirmation Dialog */}
      <AlertDialog open={isDeleteOrgDialogOpen} onOpenChange={setIsDeleteOrgDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the organization "{deleteOrg?.name}" and all associated workspaces. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-destructive px-6">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteOrg(null)
                setError(null)
              }}
              disabled={isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrganization}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Workspace Dialog */}
      <Dialog open={isCreateWorkspaceDialogOpen} onOpenChange={setIsCreateWorkspaceDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              Add a new workspace to {selectedOrg?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-workspace-name">Workspace Name</Label>
              <Input
                id="create-workspace-name"
                placeholder="My Workspace"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isPending) {
                    handleCreateWorkspace()
                  }
                }}
                disabled={isPending}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateWorkspaceDialogOpen(false)
                setWorkspaceName('')
                setError(null)
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateWorkspace} disabled={isPending}>
              {isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Workspace Dialog */}
      <Dialog open={isEditWorkspaceDialogOpen} onOpenChange={setIsEditWorkspaceDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Workspace</DialogTitle>
            <DialogDescription>
              Update the workspace name.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-workspace-name">Workspace Name</Label>
              <Input
                id="edit-workspace-name"
                placeholder="My Workspace"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isPending) {
                    handleEditWorkspace()
                  }
                }}
                disabled={isPending}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditWorkspaceDialogOpen(false)
                setWorkspaceName('')
                setEditWorkspace(null)
                setError(null)
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleEditWorkspace} disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Workspace Confirmation Dialog */}
      <AlertDialog open={isDeleteWorkspaceDialogOpen} onOpenChange={setIsDeleteWorkspaceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the workspace "{deleteWorkspace?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-destructive px-6">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteWorkspace(null)
                setError(null)
              }}
              disabled={isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkspace}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
