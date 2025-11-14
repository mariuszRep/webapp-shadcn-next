-- Create enum types for RBAC system
-- Principal types (who can have roles)
CREATE TYPE principal_kind AS ENUM ('user', 'team');

-- Resource types (what can be protected)
CREATE TYPE resource_kind AS ENUM (
  'organization',
  'workspace',
  'entity',
  'entity_type',
  'workflow'
);

-- Create organization_members junction table
CREATE TABLE IF NOT EXISTS public.organization_members (
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (org_id, user_id)
);

COMMENT ON TABLE public.organization_members IS 'Junction table linking users to organizations';

-- Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT unique_team_name_per_org UNIQUE (org_id, name)
);

COMMENT ON TABLE public.teams IS 'Teams within organizations for grouping users';

-- Create team_members junction table
CREATE TABLE IF NOT EXISTS public.team_members (
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (team_id, user_id)
);

COMMENT ON TABLE public.team_members IS 'Junction table linking users to teams';

-- Create roles table (central role registry)
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by UUID NOT NULL,
  updated_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE public.roles IS 'Central registry of all role definitions';

-- Create principal_role_assignments table
CREATE TABLE IF NOT EXISTS public.principal_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_kind principal_kind NOT NULL,
  principal_id UUID NOT NULL,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE public.principal_role_assignments IS 'Unified table for assigning roles to users or teams';

-- Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  resource resource_kind NOT NULL,
  action TEXT NOT NULL,
  apply_org_wide BOOLEAN NOT NULL DEFAULT false,
  apply_workspace_wide BOOLEAN NOT NULL DEFAULT false,
  entity_type_id UUID,
  created_by UUID NOT NULL,
  updated_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT check_entity_type_id_usage CHECK (
    (resource IN ('entity', 'entity_type') AND entity_type_id IS NOT NULL) OR
    (resource NOT IN ('entity', 'entity_type') AND entity_type_id IS NULL)
  )
);

COMMENT ON TABLE public.permissions IS 'Permissions granted to roles for specific resources and actions';

-- Create indexes for organization_members
CREATE INDEX idx_org_member_user ON public.organization_members(user_id);
CREATE INDEX idx_org_member_org ON public.organization_members(org_id);

-- Create indexes for teams
CREATE INDEX idx_team_org ON public.teams(org_id);

-- Create indexes for team_members
CREATE INDEX idx_team_member_user ON public.team_members(user_id);
CREATE INDEX idx_team_member_team ON public.team_members(team_id);

-- Create indexes for roles
CREATE INDEX idx_role_name ON public.roles(name);

-- Create indexes for principal_role_assignments
CREATE INDEX idx_pra_lookup ON public.principal_role_assignments(principal_kind, principal_id, org_id);
CREATE INDEX idx_pra_workspace ON public.principal_role_assignments(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX idx_pra_role ON public.principal_role_assignments(role_id);
CREATE INDEX idx_pra_org ON public.principal_role_assignments(org_id);

-- Create indexes for permissions
CREATE INDEX idx_permission_role_resource ON public.permissions(role_id, resource, action);
CREATE INDEX idx_permission_entity_type ON public.permissions(entity_type_id) WHERE entity_type_id IS NOT NULL;
CREATE INDEX idx_permission_role ON public.permissions(role_id);

-- Create unique constraints using partial indexes to handle NULL values
-- Unique constraint for principal_role_assignments with workspace_id
CREATE UNIQUE INDEX unique_pra_with_workspace ON public.principal_role_assignments(
  principal_kind, principal_id, org_id, workspace_id, role_id
) WHERE workspace_id IS NOT NULL;

-- Unique constraint for principal_role_assignments without workspace_id (org-level)
CREATE UNIQUE INDEX unique_pra_org_level ON public.principal_role_assignments(
  principal_kind, principal_id, org_id, role_id
) WHERE workspace_id IS NULL;

-- Unique constraint for permissions with entity_type_id
CREATE UNIQUE INDEX unique_permission_with_entity_type ON public.permissions(
  role_id, resource, action, entity_type_id
) WHERE entity_type_id IS NOT NULL;

-- Unique constraint for permissions without entity_type_id
CREATE UNIQUE INDEX unique_permission_without_entity_type ON public.permissions(
  role_id, resource, action
) WHERE entity_type_id IS NULL;
