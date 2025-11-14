'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { assignRole, removeRole, getUserRoles, getAvailableRoles } from '@/lib/actions/role-actions'
import type { Role, PrincipalRoleAssignmentWithRole } from '@/lib/types/rbac'

interface RoleManagerProps {
  orgId: string
  userId: string
  userEmail: string
  initialRoles: PrincipalRoleAssignmentWithRole[]
  availableRoles: Role[]
}

export function RoleManager({
  orgId,
  userId,
  userEmail,
  initialRoles,
  availableRoles,
}: RoleManagerProps) {
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [removingAssignmentId, setRemovingAssignmentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleAssignRole = async () => {
    if (!selectedRoleId) {
      setError('Please select a role')
      return
    }

    setError(null)
    setSuccess(null)
    setIsAssigning(true)

    try {
      const result = await assignRole(orgId, userId, selectedRoleId)

      if (result.success) {
        setSuccess('Role assigned successfully')
        setSelectedRoleId('')
        // Refresh the page to update role list
        window.location.reload()
      } else {
        setError(result.error || 'Failed to assign role')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsAssigning(false)
    }
  }

  const handleRemoveRole = async (assignmentId: string, roleName: string) => {
    if (!confirm(`Are you sure you want to remove the ${roleName} role?`)) {
      return
    }

    setError(null)
    setSuccess(null)
    setRemovingAssignmentId(assignmentId)

    try {
      const result = await removeRole(orgId, assignmentId)

      if (result.success) {
        setSuccess(`Removed ${roleName} role`)
        // Refresh the page to update role list
        window.location.reload()
      } else {
        setError(result.error || 'Failed to remove role')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setRemovingAssignmentId(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Manage Roles for {userEmail}</h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-select">Assign Role</Label>
            <div className="flex gap-2">
              <select
                id="role-select"
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                disabled={isAssigning}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a role...</option>
                {availableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} {role.description ? `- ${role.description}` : ''}
                  </option>
                ))}
              </select>
              <Button onClick={handleAssignRole} disabled={isAssigning || !selectedRoleId}>
                {isAssigning ? 'Assigning...' : 'Assign'}
              </Button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
              {success}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Current Roles</h3>

        {initialRoles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No roles assigned yet</p>
        ) : (
          <div className="space-y-2">
            {initialRoles.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-3 rounded-md border"
              >
                <div className="flex-1">
                  <p className="font-medium">{assignment.role.name}</p>
                  {assignment.role.description && (
                    <p className="text-sm text-muted-foreground">
                      {assignment.role.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {assignment.workspace_id ? 'Workspace-level' : 'Organization-level'} •
                    Assigned {new Date(assignment.created_at).toLocaleDateString()}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveRole(assignment.id, assignment.role.name)}
                  disabled={removingAssignmentId === assignment.id}
                >
                  {removingAssignmentId === assignment.id ? 'Removing...' : 'Remove'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
