'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  MoreHorizontal,
  Search,
  UserPlus,
  Settings,
  Mail,
  Trash2,
} from 'lucide-react'
import { revokeInvitation } from '@/lib/actions/invitation-actions'

interface Invitation {
  id: string
  email: string
  status: string
  userId: string
  orgRole: string
  workspaceCount: number
  expiresAt: string
  createdAt: string
}

interface InvitationsTableProps {
  organizationId: string
  invitations: Invitation[]
}

export function InvitationsTable({ organizationId, invitations }: InvitationsTableProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTab, setSelectedTab] = useState('all')
  const [invitationToDelete, setInvitationToDelete] = useState<string | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)

  // Filter invitations based on tab and search
  const filteredInvitations = useMemo(() => {
    let filtered = invitations

    // Filter by status tab
    if (selectedTab !== 'all') {
      filtered = filtered.filter(inv => inv.status === selectedTab)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(inv =>
        inv.email.toLowerCase().includes(query) ||
        inv.orgRole.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [invitations, selectedTab, searchQuery])

  // Count invitations by status
  const statusCounts = useMemo(() => {
    return {
      all: invitations.length,
      pending: invitations.filter(inv => inv.status === 'pending').length,
      accepted: invitations.filter(inv => inv.status === 'accepted').length,
      expired: invitations.filter(inv => inv.status === 'expired').length,
    }
  }, [invitations])

  const handleConfigureWorkspaces = (userId: string) => {
    router.push(`/organization/${organizationId}/settings/invitations/${userId}/workspaces`)
  }

  const handleResendEmail = async (invitationId: string, email: string) => {
    // TODO: Implement resend email functionality
    toast.info('Resend email', {
      description: `This feature will resend the invitation to ${email}`,
    })
  }

  const handleRevokeInvitation = async (invitationId: string) => {
    setIsRevoking(true)
    try {
      const result = await revokeInvitation(invitationId, organizationId)
      
      if (result.success) {
        toast.success('Invitation revoked', {
          description: 'The invitation has been revoked and user access removed',
        })
        // Refresh the page to update the invitations list
        router.refresh()
      } else {
        toast.error('Failed to revoke invitation', {
          description: result.error || 'An error occurred',
        })
      }
    } catch (error) {
      console.error('Error revoking invitation:', error)
      toast.error('Failed to revoke invitation', {
        description: 'An unexpected error occurred',
      })
    } finally {
      setIsRevoking(false)
      setInvitationToDelete(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      case 'accepted':
        return <Badge variant="default">Accepted</Badge>
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by email or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => router.push(`/organization/${organizationId}/settings/invitations/new`)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="all">
            All ({statusCounts.all})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({statusCounts.pending})
          </TabsTrigger>
          <TabsTrigger value="accepted">
            Accepted ({statusCounts.accepted})
          </TabsTrigger>
          <TabsTrigger value="expired">
            Expired ({statusCounts.expired})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedTab === 'all' ? 'All Invitations' : `${selectedTab.charAt(0).toUpperCase() + selectedTab.slice(1)} Invitations`}
              </CardTitle>
              <CardDescription>
                {filteredInvitations.length} invitation{filteredInvitations.length !== 1 ? 's' : ''} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredInvitations.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No invitations found matching your search' : 'No invitations yet'}
                  </p>
                  {!searchQuery && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => router.push(`/organization/${organizationId}/settings/invitations/new`)}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Invite Your First User
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Organization Role</TableHead>
                      <TableHead>Workspaces</TableHead>
                      <TableHead>Invited</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell className="font-medium">{invitation.email}</TableCell>
                        <TableCell>{getStatusBadge(invitation.status)}</TableCell>
                        <TableCell className="capitalize">{invitation.orgRole}</TableCell>
                        <TableCell>{invitation.workspaceCount}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistanceToNow(new Date(invitation.createdAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleConfigureWorkspaces(invitation.userId)}
                              >
                                <Settings className="mr-2 h-4 w-4" />
                                Configure Workspaces
                              </DropdownMenuItem>
                              {invitation.status === 'pending' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleResendEmail(invitation.id, invitation.email)}
                                  >
                                    <Mail className="mr-2 h-4 w-4" />
                                    Resend Email
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() => setInvitationToDelete(invitation.id)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Revoke Invitation
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!invitationToDelete} onOpenChange={() => setInvitationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this invitation? This action will remove the user's access
              to the organization and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => invitationToDelete && handleRevokeInvitation(invitationToDelete)}
              className="bg-red-600 hover:bg-red-700"
              disabled={isRevoking}
            >
              {isRevoking ? 'Revoking...' : 'Revoke'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
