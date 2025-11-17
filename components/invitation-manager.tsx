'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Mail, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { getOrgInvitations, resendInvitation, revokeInvitation } from '@/lib/actions/member-actions'
import type { InvitationWithDetails } from '@/lib/types/rbac'

interface InvitationManagerProps {
  orgId: string
}

export function InvitationManager({ orgId }: InvitationManagerProps) {
  const [invitations, setInvitations] = useState<InvitationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actioningId, setActioningId] = useState<string | null>(null)

  // Load invitations
  useEffect(() => {
    loadInvitations()
  }, [orgId])

  const loadInvitations = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await getOrgInvitations(orgId)

      if (result.success) {
        setInvitations(result.invitations || [])
      } else {
        setError(result.error || 'Failed to load invitations')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async (invitationId: string, email: string) => {
    setActioningId(invitationId)
    setError(null)

    try {
      const result = await resendInvitation(invitationId)

      if (result.success) {
        // Refresh invitations
        await loadInvitations()
      } else {
        setError(result.error || 'Failed to resend invitation')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setActioningId(null)
    }
  }

  const handleRevoke = async (invitationId: string, email: string) => {
    if (!confirm(`Are you sure you want to revoke the invitation for ${email}?`)) {
      return
    }

    setActioningId(invitationId)
    setError(null)

    try {
      const result = await revokeInvitation(invitationId)

      if (result.success) {
        // Refresh invitations
        await loadInvitations()
      } else {
        setError(result.error || 'Failed to revoke invitation')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setActioningId(null)
    }
  }

  const getInvitationStatus = (invitation: InvitationWithDetails) => {
    if (invitation.deleted_at) {
      return { label: 'Revoked', variant: 'destructive' as const, icon: XCircle }
    }
    if (invitation.accepted_at) {
      return { label: 'Accepted', variant: 'default' as const, icon: CheckCircle }
    }
    const isExpired = new Date(invitation.expiry_at) < new Date()
    if (isExpired) {
      return { label: 'Expired', variant: 'secondary' as const, icon: Clock }
    }
    return { label: 'Pending', variant: 'outline' as const, icon: Mail }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const pendingInvitations = invitations.filter(
    inv => !inv.deleted_at && !inv.accepted_at && new Date(inv.expiry_at) >= new Date()
  )
  const acceptedInvitations = invitations.filter(inv => inv.accepted_at)
  const revokedInvitations = invitations.filter(inv => inv.deleted_at)
  const expiredInvitations = invitations.filter(
    inv => !inv.deleted_at && !inv.accepted_at && new Date(inv.expiry_at) < new Date()
  )

  const renderInvitationTable = (invitationList: InvitationWithDetails[], showActions: boolean = false) => {
    if (invitationList.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No invitations in this category
        </div>
      )
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Invited By</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              {showActions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitationList.map((invitation) => {
              const status = getInvitationStatus(invitation)
              const StatusIcon = status.icon

              return (
                <TableRow key={invitation.id}>
                  <TableCell className="font-medium">{invitation.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {invitation.role?.name || 'Member'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {invitation.invited_by_user?.email || 'Unknown'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(invitation.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(invitation.expiry_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant} className="flex items-center gap-1 w-fit">
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Badge>
                  </TableCell>
                  {showActions && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResend(invitation.id, invitation.email)}
                          disabled={actioningId === invitation.id}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Resend
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRevoke(invitation.id, invitation.email)}
                          disabled={actioningId === invitation.id}
                        >
                          Revoke
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Loading invitations...</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6 border-destructive bg-destructive/10">
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold">Invitations</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Manage pending and past organization invitations
        </p>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">
            Pending ({pendingInvitations.length})
          </TabsTrigger>
          <TabsTrigger value="accepted">
            Accepted ({acceptedInvitations.length})
          </TabsTrigger>
          <TabsTrigger value="expired">
            Expired ({expiredInvitations.length})
          </TabsTrigger>
          <TabsTrigger value="revoked">
            Revoked ({revokedInvitations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {renderInvitationTable(pendingInvitations, true)}
        </TabsContent>

        <TabsContent value="accepted" className="mt-4">
          {renderInvitationTable(acceptedInvitations)}
        </TabsContent>

        <TabsContent value="expired" className="mt-4">
          {renderInvitationTable(expiredInvitations)}
        </TabsContent>

        <TabsContent value="revoked" className="mt-4">
          {renderInvitationTable(revokedInvitations)}
        </TabsContent>
      </Tabs>
    </Card>
  )
}
