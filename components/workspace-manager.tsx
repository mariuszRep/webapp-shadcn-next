'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Edit2, Plus, Trash2 } from 'lucide-react'

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
import type { Workspace } from '@/lib/types/database'
import { createWorkspace, updateWorkspace, deleteWorkspace, getOrganizationWorkspaces } from '@/lib/actions/workspace-actions'

interface WorkspaceManagerProps {
  organizationId: string
  organizationName: string
}

export function WorkspaceManager({ organizationId, organizationName }: WorkspaceManagerProps) {
  const router = useRouter()
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = React.useState<Workspace | null>(null)
  const [workspaceName, setWorkspaceName] = React.useState('')
  const [isPending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  // Load workspaces when organization changes
  React.useEffect(() => {
    async function loadWorkspaces() {
      setIsLoading(true)
      const result = await getOrganizationWorkspaces(organizationId)

      if (result.success && result.workspaces) {
        setWorkspaces(result.workspaces)
      } else {
        setError(result.error || 'Failed to load workspaces')
      }

      setIsLoading(false)
    }

    loadWorkspaces()
  }, [organizationId])

  const refreshWorkspaces = async () => {
    const result = await getOrganizationWorkspaces(organizationId)

    if (result.success && result.workspaces) {
      setWorkspaces(result.workspaces)
    }
  }

  const handleCreateWorkspace = () => {
    if (!workspaceName.trim()) {
      setError('Workspace name is required')
      return
    }

    setError(null)

    startTransition(async () => {
      const result = await createWorkspace(organizationId, workspaceName)

      if (result.success) {
        setIsCreateDialogOpen(false)
        setWorkspaceName('')
        await refreshWorkspaces()
      } else {
        setError(result.error || 'Failed to create workspace')
      }
    })
  }

  const handleEditWorkspace = () => {
    if (!selectedWorkspace) return

    if (!workspaceName.trim()) {
      setError('Workspace name is required')
      return
    }

    setError(null)

    startTransition(async () => {
      const result = await updateWorkspace(selectedWorkspace.id, workspaceName)

      if (result.success) {
        setIsEditDialogOpen(false)
        setWorkspaceName('')
        setSelectedWorkspace(null)
        await refreshWorkspaces()
      } else {
        setError(result.error || 'Failed to update workspace')
      }
    })
  }

  const handleDeleteWorkspace = () => {
    if (!selectedWorkspace) return

    startTransition(async () => {
      const result = await deleteWorkspace(selectedWorkspace.id)

      if (result.success) {
        setIsDeleteDialogOpen(false)
        setSelectedWorkspace(null)
        await refreshWorkspaces()
      } else {
        setError(result.error || 'Failed to delete workspace')
      }
    })
  }

  const handleSwitchWorkspace = (workspace: Workspace) => {
    router.push(`/organization/${organizationId}/workspace/${workspace.id}`)
  }

  const openEditDialog = (workspace: Workspace) => {
    setSelectedWorkspace(workspace)
    setWorkspaceName(workspace.name)
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (workspace: Workspace) => {
    setSelectedWorkspace(workspace)
    setIsDeleteDialogOpen(true)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workspaces</CardTitle>
          <CardDescription>Loading workspaces for {organizationName}...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Workspaces</CardTitle>
              <CardDescription>
                Manage workspaces for {organizationName}
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Workspace
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {workspaces.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">
                No workspaces found. Create one to get started.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Workspace
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="font-medium">{workspace.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Created {new Date(workspace.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSwitchWorkspace(workspace)}
                      disabled={isPending}
                    >
                      Switch
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(workspace)}
                      disabled={isPending}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(workspace)}
                      disabled={isPending || workspace.name === 'Personal'}
                      title={workspace.name === 'Personal' ? 'Cannot delete personal workspace' : 'Delete workspace'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              Add a new workspace to {organizationName}.
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
                setIsCreateDialogOpen(false)
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

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
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
                setIsEditDialogOpen(false)
                setWorkspaceName('')
                setSelectedWorkspace(null)
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the workspace "{selectedWorkspace?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-destructive px-6">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setSelectedWorkspace(null)
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
