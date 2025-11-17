'use client'

import * as React from 'react'
import { Building2, Check, Pencil, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
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
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [tempSelectedOrgId, setTempSelectedOrgId] = React.useState<string | null>(selectedOrgId)
  const [createMode, setCreateMode] = React.useState(false)
  const [editingOrgId, setEditingOrgId] = React.useState<string | null>(null)
  const [deleteConfirmOrgId, setDeleteConfirmOrgId] = React.useState<string | null>(null)
  const [orgName, setOrgName] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  const selectedOrg = organizations.find(org => org.id === selectedOrgId)

  React.useEffect(() => {
    setTempSelectedOrgId(selectedOrgId)
  }, [selectedOrgId])

  const handleConfirmSelection = () => {
    if (tempSelectedOrgId) {
      onSelectOrg(tempSelectedOrgId)
      setDialogOpen(false)
      toast.success('Organization switched successfully')
    }
  }

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
      <div className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Organization</span>
            <span className="font-semibold">
              {selectedOrg?.name || 'No organization selected'}
            </span>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Switch</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Manage Organizations</DialogTitle>
              <DialogDescription>
                Select an organization or manage your organizations below.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Create New Organization */}
              {createMode ? (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-org-name">Organization Name</Label>
                    <Input
                      id="new-org-name"
                      value={orgName}
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
                <Button onClick={startCreate} variant="outline" className="w-full" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Organization
                </Button>
              )}

              <Separator />

              {/* Organization List */}
              <RadioGroup value={tempSelectedOrgId || ''} onValueChange={setTempSelectedOrgId}>
                <div className="space-y-2">
                  {organizations.map((org) => (
                    <div key={org.id}>
                      {editingOrgId === org.id ? (
                        <div className="space-y-3 rounded-lg border p-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-org-name">Organization Name</Label>
                            <Input
                              id="edit-org-name"
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
                        <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent">
                          <div className="flex items-center gap-3 flex-1">
                            <RadioGroupItem value={org.id} id={org.id} />
                            <Label htmlFor={org.id} className="flex-1 cursor-pointer font-normal">
                              {org.name}
                              {selectedOrgId === org.id && (
                                <span className="ml-2 text-xs text-muted-foreground">(current)</span>
                              )}
                            </Label>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => startEdit(org)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirmOrgId(org.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <DialogFooter>
              <Button
                onClick={handleConfirmSelection}
                disabled={!tempSelectedOrgId || tempSelectedOrgId === selectedOrgId}
              >
                <Check className="mr-2 h-4 w-4" />
                Confirm Selection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
