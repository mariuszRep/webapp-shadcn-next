// RBAC Type Definitions
// Matches database schema with plural table names

// Enum types matching database enums
export type PrincipalKind = 'user' | 'team'
export type ResourceKind = 'organization' | 'workspace' | 'entity' | 'entity_type' | 'workflow'

// Action types for permissions
export type ActionType =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'manage_members'
  | 'manage_teams'
  | 'manage_roles'
  | 'execute'

// Role interface (matches roles table)
export interface Role {
  id: string
  name: string
  description: string | null
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// Permission interface (matches permissions table)
export interface Permission {
  id: string
  role_id: string
  resource: ResourceKind
  action: string
  apply_org_wide: boolean
  apply_workspace_wide: boolean
  entity_type_id: string | null
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// Principal Role Assignment interface (matches principal_role_assignments table)
export interface PrincipalRoleAssignment {
  id: string
  principal_kind: PrincipalKind
  principal_id: string
  org_id: string
  workspace_id: string | null
  role_id: string
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// Team interface (matches teams table)
export interface Team {
  id: string
  org_id: string
  name: string
  description: string | null
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// Team Member interface (matches team_members table)
export interface TeamMember {
  team_id: string
  user_id: string
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// Organization Member interface (matches organization_members table)
export interface OrganizationMember {
  org_id: string
  user_id: string
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// Extended types with joined data
export interface OrganizationMemberWithUser extends OrganizationMember {
  user: {
    id: string
    email: string
  }
}

export interface PrincipalRoleAssignmentWithRole extends PrincipalRoleAssignment {
  role: Role
}
