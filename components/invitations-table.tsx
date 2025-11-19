'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
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
  ChevronDown,
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
  const [selectedTab, setSelectedTab] = useState('all')
  const [invitationToDelete, setInvitationToDelete] = useState<string | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)

  // Table state
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})

  // Filter invitations based on tab
  const filteredInvitations = useMemo(() => {
    if (selectedTab === 'all') return invitations
    return invitations.filter(inv => inv.status === selectedTab)
  }, [invitations, selectedTab])

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

  const columns: ColumnDef<Invitation>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => <div className="font-medium">{row.getValue('email')}</div>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => getStatusBadge(row.getValue('status')),
    },
    {
      accessorKey: 'orgRole',
      header: 'Organization Role',
      cell: ({ row }) => <div className="capitalize">{row.getValue('orgRole')}</div>,
    },
    {
      accessorKey: 'workspaceCount',
      header: 'Workspaces',
      cell: ({ row }) => <div>{row.getValue('workspaceCount')}</div>,
    },
    {
      accessorKey: 'createdAt',
      header: 'Invited',
      cell: ({ row }) => (
        <div className="text-muted-foreground">
          {formatDistanceToNow(new Date(row.getValue('createdAt')), { addSuffix: true })}
        </div>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const invitation = row.original
        return (
          <div className="text-right">
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
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: filteredInvitations,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Invitations</h2>
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

        <TabsContent value={selectedTab} className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative max-w-lg w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter by email..."
                  value={(table.getColumn('email')?.getFilterValue() as string) ?? ''}
                  onChange={(event) =>
                    table.getColumn('email')?.setFilterValue(event.target.value)
                  }
                  className="pl-9 w-[400px]"
                />
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-auto">
                  Columns <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end space-x-2 py-4">
            <div className="flex-1 text-sm text-muted-foreground">
              {table.getFilteredSelectedRowModel().rows.length} of{' '}
              {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
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

