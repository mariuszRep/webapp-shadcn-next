'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { inviteOrgMember, removeOrgMember, getAvailableRoles } from '@/lib/actions/member-actions'
import { InvitationManager } from '@/components/invitation-manager'
import type { OrganizationMemberWithUser, Role } from '@/lib/types/rbac'

interface MemberManagerProps {
  orgId: string
  members: OrganizationMemberWithUser[]
}

export function MemberManager({ orgId, members: initialMembers }: MemberManagerProps) {
  const [email, setEmail] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [roles, setRoles] = useState<Role[]>([])
  const [isInviting, setIsInviting] = useState(false)
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Load available roles
  useEffect(() => {
    loadRoles()
  }, [])

  const loadRoles = async () => {
    const result = await getAvailableRoles()
    if (result.success && result.roles) {
      setRoles(result.roles)
      // Set default to org_member if available
      const defaultRole = result.roles.find(r => r.name === 'org_member')
      if (defaultRole) {
        setSelectedRoleId(defaultRole.id)
      }
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setIsInviting(true)

    try {
      const result = await inviteOrgMember(orgId, email, selectedRoleId || undefined)

      if (result.success) {
        setSuccess(`Invitation sent to ${email}`)
        setEmail('')
        // Refresh the page to show new invitation
        window.location.reload()
      } else {
        setError(result.error || 'Failed to send invitation')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsInviting(false)
    }
  }

  const handleRemove = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to remove ${userEmail} from this organization?`)) {
      return
    }

    setError(null)
    setSuccess(null)
    setRemovingUserId(userId)

    try {
      const result = await removeOrgMember(orgId, userId)

      if (result.success) {
        setSuccess(`Removed ${userEmail} from organization`)
        // Refresh the page to update member list
        window.location.reload()
      } else {
        setError(result.error || 'Failed to remove member')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setRemovingUserId(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Invite Member</h3>

        <form onSubmit={handleInvite} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isInviting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={selectedRoleId}
                onValueChange={setSelectedRoleId}
                disabled={isInviting}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={isInviting} className="w-full md:w-auto">
            {isInviting ? 'Sending Invitation...' : 'Send Invitation'}
          </Button>

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
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Organization Members</h3>

        {initialMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet</p>
        ) : (
          <div className="space-y-2">
            {initialMembers.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between p-3 rounded-md border"
              >
                <div className="flex-1">
                  <p className="font-medium">{member.user.email}</p>
                  <p className="text-sm text-muted-foreground">
                    Joined {new Date(member.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemove(member.user_id, member.user.email)}
                  disabled={removingUserId === member.user_id}
                >
                  {removingUserId === member.user_id ? 'Removing...' : 'Remove'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <InvitationManager orgId={orgId} />
    </div>
  )
}
