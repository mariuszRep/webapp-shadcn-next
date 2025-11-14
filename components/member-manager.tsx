'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { inviteOrgMember, removeOrgMember } from '@/lib/actions/member-actions'
import type { OrganizationMemberWithUser } from '@/lib/types/rbac'

interface MemberManagerProps {
  orgId: string
  members: OrganizationMemberWithUser[]
}

export function MemberManager({ orgId, members: initialMembers }: MemberManagerProps) {
  const [email, setEmail] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
      const result = await inviteOrgMember(orgId, email)

      if (result.success) {
        setSuccess(`Invitation sent to ${email}`)
        setEmail('')
        // Refresh the page to show new member
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
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isInviting}
                className="flex-1"
                required
              />
              <Button type="submit" disabled={isInviting}>
                {isInviting ? 'Inviting...' : 'Invite'}
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
    </div>
  )
}
