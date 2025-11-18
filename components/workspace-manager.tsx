'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Folder, Plus, Pencil, Trash2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { createWorkspace, updateWorkspace, deleteWorkspace, getOrganizationWorkspaces } from '@/lib/actions/workspace'
import type { Workspace } from '@/lib/types/database'

interface WorkspaceManagerProps {
  organizationId: string
  organizationName: string
}

export function WorkspaceManager({ organizationId, organizationName }: WorkspaceManagerProps) {
  const router = useRouter()
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingWorkspace, setEditingWorkspace] = React.useState<Workspace | null>(null)
  const [deleteConfirmWorkspace, setDeleteConfirmWorkspace] = React.useState<Workspace | null>(null)
  const [workspaceName, setWorkspaceName] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const loadWorkspaces = React.useCallback(async () => {
    setLoading(true)
    const result = await getOrganizationWorkspaces(organizationId)
    setLoading(false)

    if (result.success && result.workspaces) {
      setWorkspaces(result.workspaces)
    } else {
      toast.error(result.error || 'Failed to load workspaces')
    }
  }, [organizationId])

  React.useEffect(() => {
    loadWorkspaces()
  }, [loadWorkspaces])

  const handleOpenDialog = (workspace?: Workspace) => {
    if (workspace) {
      setEditingWorkspace(workspace)
      setWorkspaceName(workspace.name)
    } else {
      setEditingWorkspace(null)
      setWorkspaceName('')
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingWorkspace(null)
    setWorkspaceName('')
  }

  const handleSubmit = async () => {
    if (!workspaceName.trim()) {
      toast.error('Workspace name is required')
      return
    }

    setSubmitting(true)

    if (editingWorkspace) {
      const result = await updateWorkspace(editingWorkspace.id, workspaceName)
      setSubmitting(false)

      if (result.success) {
        toast.success('Workspace updated successfully')
        handleCloseDialog()
        loadWorkspaces()
      } else {
        toast.error(result.error || 'Failed to update workspace')
      }
    } else {
      const result = await createWorkspace(organizationId, workspaceName)
      setSubmitting(false)

      if (result.success) {
        toast.success('Workspace created successfully')
        handleCloseDialog()
        loadWorkspaces()
      } else {
        toast.error(result.error || 'Failed to create workspace')
      }
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirmWorkspace) return

    setSubmitting(true)
    const result = await deleteWorkspace(deleteConfirmWorkspace.id)
    setSubmitting(false)

    if (result.success) {
      toast.success('Workspace deleted successfully')
      setDeleteConfirmWorkspace(null)
      loadWorkspaces()
    } else {
      toast.error(result.error || 'Failed to delete workspace')
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Workspaces</h3>
            <p className="text-sm text-muted-foreground">
              Manage workspaces for {organizationName}
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Create Workspace
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Loading workspaces...</p>
          </div>
        ) : workspaces.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Folder className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground mb-4">No workspaces found</p>
              <Button onClick={() => handleOpenDialog()} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Workspace
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => (
              <Card key={workspace.id} className="relative group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Folder className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{workspace.name}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          Created {new Date(workspace.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => router.push(`/organization/${organizationId}/workspace/${workspace.id}`)}
                    >
                      <ArrowRight className="mr-2 h-3 w-3" />
                      Go to Workspace
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(workspace)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmWorkspace(workspace)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingWorkspace ? 'Edit Workspace' : 'Create New Workspace'}
            </DialogTitle>
            <DialogDescription>
              {editingWorkspace
                ? 'Update the workspace name below.'
                : 'Enter a name for your new workspace.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input
                id="workspace-name"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Enter workspace name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmit()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {editingWorkspace ? 'Save Changes' : 'Create Workspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmWorkspace}
        onOpenChange={() => setDeleteConfirmWorkspace(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the workspace "{deleteConfirmWorkspace?.name}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={submitting}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
