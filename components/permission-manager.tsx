'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { Building2, FolderKanban, Shield, Trash2, Plus, Search, ChevronDown, MoreHorizontal, Pencil } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  assignRole,
  revokeRole,
  getAllOrgPermissions,
  getOrgMembers,
  getAllRoles,
  getUserOrganizations,
  getOrganizationWorkspaces,
  createRole,
  updateRole,
  deleteRole,
} from '@/lib/actions/permission-actions'
import { usePermissionStore } from '@/lib/stores/permissionStore'
import { addPermissionSchema, roleFormSchema, updateRoleSchema } from '@/lib/validations/permission-schemas'
import type { PermissionAction, ObjectType, Role } from '@/lib/types/database'

interface PermissionManagerProps {
  orgId: string
}

interface PermissionWithDetails {
  id: string
  principal_type: string
  principal_id: string
  role_id: string
  object_type: ObjectType
  object_id: string | null
  role?: Role
  user_email?: string
  user_name?: string
}

interface OrgMember {
  org_id: string
  user_id: string
  role_id: string
  role_name: string
  email?: string
  name?: string
}

export function PermissionManager({ orgId }: PermissionManagerProps) {
  const [permissions, setPermissions] = useState<PermissionWithDetails[]>([])
  const [members, setMembers] = useState<OrgMember[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([])
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteRoleDialogOpen, setDeleteRoleDialogOpen] = useState(false)
  const [permissionToDelete, setPermissionToDelete] = useState<PermissionWithDetails | null>(null)
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null)
  const [activeTab, setActiveTab] = useState('permissions')

  // Zustand store for dialog state
  const {
    addPermissionOpen,
    addRoleOpen,
    editRoleOpen,
    selectedRole,
    setAddPermissionOpen,
    setAddRoleOpen,
    setEditRoleOpen,
    setSelectedRole,
  } = usePermissionStore()

  // Form state for Add Permission
  const [selectedPrincipalId, setSelectedPrincipalId] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [selectedObjectType, setSelectedObjectType] = useState<ObjectType>('organization')
  const [selectedObjectId, setSelectedObjectId] = useState<string>('all')
  const [submitting, setSubmitting] = useState(false)

  // Form for Add/Edit Role
  const roleForm = useForm({
    resolver: zodResolver(editRoleOpen ? updateRoleSchema : roleFormSchema),
    defaultValues: {
      name: '',
      description: '',
      permissions: [] as PermissionAction[],
    },
  })

  // Table state
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})

  // Role table state
  const [roleSorting, setRoleSorting] = useState<SortingState>([])
  const [roleFilters, setRoleFilters] = useState<ColumnFiltersState>([])
  const [roleRowSelection, setRoleRowSelection] = useState({})

  // Deduplicate members by user_id for the user selection dropdown
  const uniqueMembers = members.reduce((acc, member) => {
    if (!acc.find(m => m.user_id === member.user_id)) {
      acc.push(member)
    }
    return acc
  }, [] as OrgMember[])

  useEffect(() => {
    loadData()
  }, [orgId])

  useEffect(() => {
    // Load workspaces when object type changes to workspace
    if (selectedObjectType === 'workspace') {
      loadWorkspaces()
    }
  }, [selectedObjectType, orgId])

  // Pre-fill form when editing role
  useEffect(() => {
    if (editRoleOpen && selectedRole) {
      roleForm.reset({
        name: selectedRole.name,
        description: selectedRole.description || '',
        permissions: selectedRole.permissions,
      })
    } else if (!editRoleOpen) {
      roleForm.reset({
        name: '',
        description: '',
        permissions: [],
      })
    }
  }, [editRoleOpen, selectedRole])

  async function loadData() {
    setLoading(true)
    try {
      // Load organization members with email/name
      const membersResult = await getOrgMembers(orgId)
      if (membersResult.success && membersResult.members) {
        setMembers(membersResult.members)
      }

      // Load all available roles
      const rolesResult = await getAllRoles()
      if (rolesResult.success && rolesResult.roles) {
        setRoles(rolesResult.roles)
      }

      // Load organizations user has access to
      const orgsResult = await getUserOrganizations()
      if (orgsResult.success && orgsResult.organizations) {
        setOrganizations(orgsResult.organizations)
      }

      // Load ALL permissions for this organization (all object types)
      const permsResult = await getAllOrgPermissions(orgId)
      if (permsResult.success && permsResult.permissions) {
        setPermissions(permsResult.permissions as PermissionWithDetails[])
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load permissions')
    } finally {
      setLoading(false)
    }
  }

  async function loadWorkspaces() {
    try {
      const result = await getOrganizationWorkspaces(orgId)
      if (result.success && result.workspaces) {
        setWorkspaces(result.workspaces)
      }
    } catch (error) {
      console.error('Error loading workspaces:', error)
    }
  }

  async function handleAssignRole() {
    if (!selectedPrincipalId || !selectedRoleId) {
      toast.error('Please select a user and role')
      return
    }

    setSubmitting(true)
    try {
      const result = await assignRole({
        org_id: orgId,
        principal_type: 'user',
        principal_id: selectedPrincipalId,
        role_id: selectedRoleId,
        object_type: selectedObjectType,
        object_id: selectedObjectId === 'all' ? null : selectedObjectId,
      })

      if (result.success) {
        toast.success('Permission assigned successfully')
        loadData()
        // Reset form
        setSelectedPrincipalId('')
        setSelectedRoleId('')
        setSelectedObjectType('organization')
        setSelectedObjectId('all')
        setAddPermissionOpen(false)
      } else {
        toast.error(result.error || 'Failed to assign permission')
      }
    } catch (error) {
      console.error('Error assigning role:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeletePermission() {
    if (!permissionToDelete) return

    try {
      const result = await revokeRole(permissionToDelete.id)
      if (result.success) {
        toast.success('Permission revoked successfully')
        loadData()
      } else {
        toast.error(result.error || 'Failed to revoke permission')
      }
    } catch (error) {
      console.error('Error revoking permission:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setDeleteDialogOpen(false)
      setPermissionToDelete(null)
    }
  }

  async function handleDeleteSelected() {
    const selectedRows = table.getFilteredSelectedRowModel().rows
    if (selectedRows.length === 0) return

    const confirmed = confirm(`Are you sure you want to revoke ${selectedRows.length} permission(s)?`)
    if (!confirmed) return

    try {
      for (const row of selectedRows) {
        await revokeRole(row.original.id)
      }
      toast.success(`Revoked ${selectedRows.length} permission(s)`)
      setRowSelection({})
      loadData()
    } catch (error) {
      console.error('Error revoking permissions:', error)
      toast.error('Failed to revoke some permissions')
    }
  }

  async function handleCreateRole(data: any) {
    console.log('handleCreateRole called with data:', data)
    console.log('orgId:', orgId)

    setSubmitting(true)
    try {
      const payload = {
        ...data,
        org_id: orgId,
      }
      console.log('Calling createRole with payload:', payload)

      const result = await createRole(payload)
      console.log('createRole result:', result)

      if (result.success) {
        toast.success('Role created successfully')
        roleForm.reset()
        setAddRoleOpen(false)
        loadData()
      } else {
        console.error('Create role failed:', result.error)
        toast.error(result.error || 'Failed to create role')
      }
    } catch (error) {
      console.error('Error creating role:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdateRole(data: any) {
    if (!selectedRole) return

    setSubmitting(true)
    try {
      const result = await updateRole(selectedRole.id, data)

      if (result.success) {
        toast.success('Role updated successfully')
        roleForm.reset()
        setEditRoleOpen(false)
        setSelectedRole(null)
        loadData()
      } else {
        toast.error(result.error || 'Failed to update role')
      }
    } catch (error) {
      console.error('Error updating role:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteRole() {
    if (!roleToDelete) return

    try {
      const result = await deleteRole(roleToDelete.id)
      if (result.success) {
        toast.success('Role deleted successfully')
        setDeleteRoleDialogOpen(false)
        setRoleToDelete(null)
        loadData()
      } else {
        toast.error(result.error || 'Failed to delete role')
      }
    } catch (error) {
      console.error('Error deleting role:', error)
      toast.error('An unexpected error occurred')
    }
  }

  const getActionBadgeVariant = (action: PermissionAction): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (action) {
      case 'select': return 'default'
      case 'insert': return 'secondary'
      case 'update': return 'outline'
      case 'delete': return 'destructive'
      default: return 'default'
    }
  }

  const getInitials = (email?: string, name?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    if (email) {
      return email.slice(0, 2).toUpperCase()
    }
    return '??'
  }

  // Get object display name
  const getObjectDisplayName = (objectType: ObjectType, objectId: string | null) => {
    if (objectId === null) {
      return `All ${objectType}s`
    }

    if (objectType === 'organization') {
      const org = organizations.find(o => o.id === objectId)
      return org?.name || objectId
    }

    if (objectType === 'workspace') {
      const ws = workspaces.find(w => w.id === objectId)
      return ws?.name || objectId
    }

    return objectId
  }

  // Define permissions columns
  const permissionsColumns: ColumnDef<PermissionWithDetails>[] = [
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
      accessorKey: 'user_email',
      header: 'User',
      cell: ({ row }) => {
        const permission = row.original
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {getInitials(permission.user_email, permission.user_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {permission.user_name || permission.user_email}
              </span>
              {permission.user_name && permission.user_email && (
                <span className="text-xs text-muted-foreground">{permission.user_email}</span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'role.name',
      header: 'Role',
      cell: ({ row }) => {
        const permission = row.original
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{permission.role?.name}</span>
            {permission.role?.description && (
              <span className="text-xs text-muted-foreground">{permission.role.description}</span>
            )}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: 'Permissions',
      cell: ({ row }) => {
        const permission = row.original
        return (
          <div className="flex flex-wrap gap-1">
            {permission.role?.permissions.map((action) => (
              <Badge key={action} variant={getActionBadgeVariant(action)} className="text-xs">
                {action}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      accessorKey: 'object_type',
      header: 'Object Type',
      cell: ({ row }) => {
        const permission = row.original
        return (
          <div className="flex items-center gap-2">
            {permission.object_type === 'organization' ? (
              <Building2 className="h-4 w-4 text-muted-foreground" />
            ) : (
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm capitalize">{permission.object_type}</span>
          </div>
        )
      },
    },
    {
      id: 'object',
      header: 'Object',
      cell: ({ row }) => {
        const permission = row.original
        return (
          <span className="text-sm">
            {getObjectDisplayName(permission.object_type, permission.object_id)}
          </span>
        )
      },
    },
    {
      id: 'row_actions',
      enableHiding: false,
      cell: ({ row }) => {
        const permission = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(permission.id)}
              >
                Copy permission ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setPermissionToDelete(permission)
                  setDeleteDialogOpen(true)
                }}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Revoke permission
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  // Define roles columns
  const rolesColumns: ColumnDef<Role>[] = [
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
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const role = row.original
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium capitalize">{role.name}</span>
            {role.description && (
              <span className="text-xs text-muted-foreground line-clamp-2">{role.description}</span>
            )}
          </div>
        )
      },
    },
    {
      id: 'permissions',
      header: 'Permissions',
      cell: ({ row }) => {
        const role = row.original
        return (
          <div className="flex flex-wrap gap-1">
            {role.permissions.map((action) => (
              <Badge key={action} variant={getActionBadgeVariant(action)} className="text-xs">
                {action}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      id: 'scope',
      header: 'Scope',
      cell: ({ row }) => {
        const role = row.original
        return (
          <Badge variant="outline" className="text-xs">
            {role.org_id ? 'Organization' : 'System'}
          </Badge>
        )
      },
    },
    {
      id: 'row_actions',
      enableHiding: false,
      cell: ({ row }) => {
        const role = row.original
        // Don't allow editing system roles
        if (!role.org_id) return null

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedRole(role)
                  setEditRoleOpen(true)
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit role
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setRoleToDelete(role)
                  setDeleteRoleDialogOpen(true)
                }}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete role
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data: permissions,
    columns: permissionsColumns,
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

  const roleTable = useReactTable({
    data: roles,
    columns: rolesColumns,
    onSortingChange: setRoleSorting,
    onColumnFiltersChange: setRoleFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRoleRowSelection,
    state: {
      sorting: roleSorting,
      columnFilters: roleFilters,
      rowSelection: roleRowSelection,
    },
  })

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Roles
          </TabsTrigger>
        </TabsList>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Manage Permissions</h3>
              <p className="text-sm text-muted-foreground">
                Assign roles to users for organization-level or workspace-level access
              </p>
            </div>
            <Button onClick={() => setAddPermissionOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Permission
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Filter by email..."
                  value={(table.getColumn('user_email')?.getFilterValue() as string) ?? ''}
                  onChange={(event) =>
                    table.getColumn('user_email')?.setFilterValue(event.target.value)
                  }
                  className="max-w-sm"
                />
                {table.getFilteredSelectedRowModel().rows.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteSelected}
                  >
                    Revoke ({table.getFilteredSelectedRowModel().rows.length})
                  </Button>
                )}
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
                        colSpan={permissionsColumns.length}
                        className="h-24 text-center"
                      >
                        {loading ? 'Loading...' : 'No results.'}
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
          </div>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Manage Roles</h3>
              <p className="text-sm text-muted-foreground">
                Create and manage roles that define permission sets
              </p>
            </div>
            <Button onClick={() => setAddRoleOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Role
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Filter by name..."
                value={(roleTable.getColumn('name')?.getFilterValue() as string) ?? ''}
                onChange={(event) =>
                  roleTable.getColumn('name')?.setFilterValue(event.target.value)
                }
                className="max-w-sm"
              />
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  {roleTable.getHeaderGroups().map((headerGroup) => (
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
                  {roleTable.getRowModel().rows?.length ? (
                    roleTable.getRowModel().rows.map((row) => (
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
                        colSpan={rolesColumns.length}
                        className="h-24 text-center"
                      >
                        {loading ? 'Loading...' : 'No roles found.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-end space-x-2 py-4">
              <div className="flex-1 text-sm text-muted-foreground">
                {roleTable.getFilteredSelectedRowModel().rows.length} of{' '}
                {roleTable.getFilteredRowModel().rows.length} row(s) selected.
              </div>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => roleTable.previousPage()}
                  disabled={!roleTable.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => roleTable.nextPage()}
                  disabled={!roleTable.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Permission Dialog */}
      <Dialog open={addPermissionOpen} onOpenChange={setAddPermissionOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Permission</DialogTitle>
            <DialogDescription>
              Assign a role to a user for an organization or workspace
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="principal">User</Label>
              <Select value={selectedPrincipalId} onValueChange={setSelectedPrincipalId}>
                <SelectTrigger id="principal">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueMembers.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.name || member.email || member.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                The user who will receive the permission
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name} {role.description && `- ${role.description}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                The role defining what actions are allowed
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="objectType">Object Type</Label>
              <Select value={selectedObjectType} onValueChange={(value) => setSelectedObjectType(value as ObjectType)}>
                <SelectTrigger id="objectType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organization">Organization</SelectItem>
                  <SelectItem value="workspace">Workspace</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                The type of object this permission applies to
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="objectId">
                {selectedObjectType === 'organization' ? 'Organization' : 'Workspace'}
              </Label>
              <Select value={selectedObjectId} onValueChange={setSelectedObjectId}>
                <SelectTrigger id="objectId">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {selectedObjectType}s</SelectItem>
                  {selectedObjectType === 'organization' ? (
                    organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))
                  ) : (
                    workspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>
                        {ws.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Specific {selectedObjectType} or all {selectedObjectType}s
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPermissionOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignRole}
              disabled={submitting || !selectedPrincipalId || !selectedRoleId}
            >
              {submitting ? 'Adding...' : 'Add Permission'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Role Dialog */}
      <Dialog open={addRoleOpen || editRoleOpen} onOpenChange={(open) => {
        if (!open) {
          setAddRoleOpen(false)
          setEditRoleOpen(false)
          setSelectedRole(null)
          roleForm.reset()
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editRoleOpen ? 'Edit Role' : 'Create New Role'}</DialogTitle>
            <DialogDescription>
              {editRoleOpen ? 'Update the role details below' : 'Define a new role with specific permissions'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={roleForm.handleSubmit(
            editRoleOpen ? handleUpdateRole : handleCreateRole,
            (errors) => {
              console.log('Form validation errors:', errors)
              toast.error('Please fix the form errors')
            }
          )} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="roleName">Role Name</Label>
              <Input
                id="roleName"
                placeholder="e.g., Editor, Viewer, Manager"
                {...roleForm.register('name')}
              />
              {roleForm.formState.errors.name && (
                <p className="text-sm text-destructive">{roleForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="roleDescription">Description (Optional)</Label>
              <Input
                id="roleDescription"
                placeholder="Brief description of this role"
                {...roleForm.register('description')}
              />
              {roleForm.formState.errors.description && (
                <p className="text-sm text-destructive">{roleForm.formState.errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['select', 'insert', 'update', 'delete'] as PermissionAction[]).map((permission) => (
                  <div key={permission} className="flex items-center space-x-2">
                    <Checkbox
                      id={`perm-${permission}`}
                      checked={roleForm.watch('permissions')?.includes(permission)}
                      onCheckedChange={(checked) => {
                        const current = roleForm.getValues('permissions') || []
                        if (checked) {
                          roleForm.setValue('permissions', [...current, permission])
                        } else {
                          roleForm.setValue('permissions', current.filter(p => p !== permission))
                        }
                      }}
                    />
                    <label htmlFor={`perm-${permission}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize">
                      {permission}
                    </label>
                  </div>
                ))}
              </div>
              {roleForm.formState.errors.permissions && (
                <p className="text-sm text-destructive">{roleForm.formState.errors.permissions.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setAddRoleOpen(false)
                setEditRoleOpen(false)
                setSelectedRole(null)
                roleForm.reset()
              }}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : editRoleOpen ? 'Update Role' : 'Create Role'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Permission Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Permission?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke <strong>{permissionToDelete?.user_name || permissionToDelete?.user_email}</strong>
              &apos;s <strong>{permissionToDelete?.role?.name}</strong> role on{' '}
              <strong>
                {permissionToDelete && getObjectDisplayName(permissionToDelete.object_type, permissionToDelete.object_id)}
              </strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePermission}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Permission
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Role Confirmation Dialog */}
      <AlertDialog open={deleteRoleDialogOpen} onOpenChange={setDeleteRoleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the <strong>{roleToDelete?.name}</strong> role.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
