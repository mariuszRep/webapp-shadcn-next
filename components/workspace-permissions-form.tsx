'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { assignWorkspacePermissions } from '@/lib/actions/invitation-actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { ArrowLeft, Check, UserPlus } from 'lucide-react'

interface Role {
  id: string
  name: string
  description: string | null
}

interface Workspace {
  id: string
  name: string
}

interface ExistingPermission {
  workspaceId: string
  roleName: string | null
}

interface WorkspacePermissionsFormProps {
  userId: string
  organizationId: string
  userEmail: string
  orgRoleName: string
  workspaces: Workspace[]
  roles: Role[]
  existingPermissions: ExistingPermission[]
}

export function WorkspacePermissionsForm({
  userId,
  organizationId,
  userEmail,
  orgRoleName,
  workspaces,
  roles,
  existingPermissions,
}: WorkspacePermissionsFormProps) {
  const router = useRouter()
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({})
  const [selectAllRole, setSelectAllRole] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  // Initialize existing permissions
  useEffect(() => {
    const initial: Record<string, string> = {}
    existingPermissions.forEach((perm) => {
      const role = roles.find((r) => r.name === perm.roleName)
      if (role) {
        initial[perm.workspaceId] = role.id
      }
    })
    setSelectedRoles(initial)
  }, [existingPermissions, roles])

  const handleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectAllRole('')
      return
    }

    if (!selectAllRole) {
      toast.error('Please select a role first')
      return
    }

    const newSelectedRoles: Record<string, string> = {}
    workspaces.forEach((workspace) => {
      newSelectedRoles[workspace.id] = selectAllRole
    })
    setSelectedRoles(newSelectedRoles)
  }

  const handleRoleChange = (workspaceId: string, roleId: string) => {
    setSelectedRoles((prev) => {
      if (roleId === 'none') {
        const { [workspaceId]: _, ...rest } = prev
        return rest
      }
      return {
        ...prev,
        [workspaceId]: roleId,
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Convert selectedRoles to array format
      const workspacePermissions = Object.entries(selectedRoles).map(([workspaceId, roleId]) => ({
        workspaceId,
        roleId,
      }))

      const result = await assignWorkspacePermissions({
        userId,
        workspacePermissions,
      })

      if (result.success) {
        toast.success('Workspace permissions assigned!', {
          description: `${workspacePermissions.length} workspace(s) configured`,
          action: {
            label: 'View All',
            onClick: () => router.push(`/organization/${organizationId}/settings/invitations`),
          },
        })

        // Redirect to invitations list
        setTimeout(() => {
          router.push(`/organization/${organizationId}/settings/invitations`)
        }, 1500)
      } else {
        toast.error('Failed to assign permissions', {
          description: result.error || 'An unexpected error occurred',
        })
      }
    } catch (error) {
      console.error('Error assigning workspace permissions:', error)
      toast.error('Failed to assign permissions', {
        description: 'An unexpected error occurred',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const allSelected = workspaces.length > 0 && workspaces.every((w) => selectedRoles[w.id])

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Invited User</CardTitle>
          <CardDescription>User information and organization role</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="font-medium">{userEmail}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Organization Role</span>
            <Badge variant="secondary" className="capitalize">
              {orgRoleName}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Workspace Permissions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Workspace Access</CardTitle>
          <CardDescription>
            Select which workspaces this user can access and their role in each
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workspaces.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No workspaces available in this organization
              </p>
            </div>
          ) : (
            <>
              {/* Select All Controls */}
              <div className="mb-4 flex items-center gap-4 rounded-lg border p-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all"
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    disabled={isLoading}
                  />
                  <Label htmlFor="select-all" className="cursor-pointer">
                    Select All
                  </Label>
                </div>
                <div className="flex-1">
                  <Select
                    value={selectAllRole}
                    onValueChange={setSelectAllRole}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue placeholder="Choose role for all" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <span className="capitalize">{role.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Workspace Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspaces.map((workspace) => (
                    <TableRow key={workspace.id}>
                      <TableCell className="font-medium">{workspace.name}</TableCell>
                      <TableCell>
                        <Select
                          value={selectedRoles[workspace.id] || 'none'}
                          onValueChange={(value) => handleRoleChange(workspace.id, value)}
                          disabled={isLoading}
                        >
                          <SelectTrigger className="w-full max-w-xs">
                            <SelectValue placeholder="No access" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground">No access</span>
                            </SelectItem>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                <span className="capitalize">{role.name}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/organization/${organizationId}/settings/invitations`)}
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Skip
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="mr-2">Saving...</span>
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Complete Invitation
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
