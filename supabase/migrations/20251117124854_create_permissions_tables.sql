-- =====================================================
-- ROLES TABLE
-- =====================================================
-- Create roles table to define permission sets
-- Roles can be system-wide (org_id NULL) or organization-specific
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    org_id UUID NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    created_by UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_by UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Constraints
    CONSTRAINT chk_role_name_not_empty CHECK (length(trim(name)) > 0)
);

-- =====================================================
-- PERMISSIONS TABLE
-- =====================================================
-- Create permissions table with role-based object permission model
-- This table assigns roles to principals (users, teams, api_keys) for specific objects
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    principal_type TEXT NOT NULL,
    principal_id UUID NOT NULL,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    object_type TEXT NOT NULL,
    object_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Constraints
    CONSTRAINT chk_principal_type CHECK (principal_type IN ('user', 'team', 'api_key')),
    CONSTRAINT chk_object_type CHECK (object_type IN ('organization', 'workspace', 'project', 'task'))
);

-- =====================================================
-- INDEXES
-- =====================================================
-- Indexes for roles table
CREATE INDEX idx_roles_org ON public.roles(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX idx_roles_name ON public.roles(name);
CREATE INDEX idx_roles_deleted ON public.roles(deleted_at) WHERE deleted_at IS NULL;

-- Indexes for permissions table
CREATE INDEX idx_permissions_principal ON public.permissions(principal_type, principal_id, org_id);
CREATE INDEX idx_permissions_object ON public.permissions(object_type, object_id);
CREATE INDEX idx_permissions_role ON public.permissions(role_id);
CREATE INDEX idx_permissions_object_type ON public.permissions(object_type);
CREATE INDEX idx_permissions_deleted ON public.permissions(deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- MATERIALIZED VIEWS
-- =====================================================
-- Materialized view for organization members (derived from permissions)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.organization_members_view AS
SELECT DISTINCT
    p.object_id AS org_id,
    p.principal_id AS user_id,
    p.role_id,
    r.name AS role_name
FROM public.permissions p
JOIN public.roles r ON p.role_id = r.id
WHERE p.object_type = 'organization'
  AND p.principal_type = 'user'
  AND p.deleted_at IS NULL
  AND r.deleted_at IS NULL
  AND p.object_id IS NOT NULL;

-- Materialized view for workspace members (derived from permissions)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.workspace_members_view AS
SELECT DISTINCT
    p.object_id AS workspace_id,
    p.principal_id AS user_id,
    p.role_id,
    r.name AS role_name
FROM public.permissions p
JOIN public.roles r ON p.role_id = r.id
WHERE p.object_type = 'workspace'
  AND p.principal_type = 'user'
  AND p.deleted_at IS NULL
  AND r.deleted_at IS NULL
  AND p.object_id IS NOT NULL;

-- Create unique indexes on materialized views for CONCURRENT refresh
CREATE UNIQUE INDEX idx_org_members_view_unique ON public.organization_members_view(org_id, user_id, role_id);
CREATE UNIQUE INDEX idx_workspace_members_view_unique ON public.workspace_members_view(workspace_id, user_id, role_id);

-- Additional indexes for fast lookups
CREATE INDEX idx_org_members_view_user ON public.organization_members_view(user_id);
CREATE INDEX idx_workspace_members_view_user ON public.workspace_members_view(user_id);

-- =====================================================
-- SMART REFRESH TRIGGERS
-- =====================================================
-- Function to refresh materialized views based on object_type
CREATE OR REPLACE FUNCTION public.refresh_member_views()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Determine which object_type changed (works for INSERT, UPDATE, DELETE)
    IF TG_OP = 'DELETE' THEN
        -- Use OLD record for DELETE operations
        IF OLD.object_type = 'organization' THEN
            REFRESH MATERIALIZED VIEW CONCURRENTLY public.organization_members_view;
        ELSIF OLD.object_type = 'workspace' THEN
            REFRESH MATERIALIZED VIEW CONCURRENTLY public.workspace_members_view;
        END IF;
    ELSE
        -- Use NEW record for INSERT and UPDATE operations
        IF NEW.object_type = 'organization' THEN
            REFRESH MATERIALIZED VIEW CONCURRENTLY public.organization_members_view;
        ELSIF NEW.object_type = 'workspace' THEN
            REFRESH MATERIALIZED VIEW CONCURRENTLY public.workspace_members_view;
        END IF;

        -- For UPDATE, also check if object_type changed
        IF TG_OP = 'UPDATE' AND OLD.object_type != NEW.object_type THEN
            IF OLD.object_type = 'organization' THEN
                REFRESH MATERIALIZED VIEW CONCURRENTLY public.organization_members_view;
            ELSIF OLD.object_type = 'workspace' THEN
                REFRESH MATERIALIZED VIEW CONCURRENTLY public.workspace_members_view;
            END IF;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Create trigger on permissions table
DROP TRIGGER IF EXISTS trg_refresh_member_views ON public.permissions;
CREATE TRIGGER trg_refresh_member_views
    AFTER INSERT OR UPDATE OR DELETE ON public.permissions
    FOR EACH ROW
    EXECUTE FUNCTION public.refresh_member_views();

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================
-- Table comments
COMMENT ON TABLE public.roles IS 'Defines permission sets that can be assigned to principals. Roles contain a JSONB array of allowed actions (read, create, update, delete).';
COMMENT ON TABLE public.permissions IS 'Role-based object permission model. Assigns roles to principals (users, teams, api_keys) for specific objects (organizations, workspaces, projects, tasks).';
COMMENT ON MATERIALIZED VIEW public.organization_members_view IS 'Materialized view of users with permissions on organizations. Automatically refreshed when permissions change.';
COMMENT ON MATERIALIZED VIEW public.workspace_members_view IS 'Materialized view of users with permissions on workspaces. Automatically refreshed when permissions change.';

-- Column comments for roles table
COMMENT ON COLUMN public.roles.name IS 'Role name (e.g., admin, member, viewer)';
COMMENT ON COLUMN public.roles.permissions IS 'JSONB array of allowed actions, e.g., ["read", "create", "update", "delete"]';
COMMENT ON COLUMN public.roles.org_id IS 'Organization this role belongs to. NULL means system-wide role.';
COMMENT ON COLUMN public.roles.deleted_at IS 'Soft delete timestamp. NULL means active, non-null means deleted.';

-- Column comments for permissions table
COMMENT ON COLUMN public.permissions.org_id IS 'Organization this permission belongs to. All permissions are scoped to an organization.';
COMMENT ON COLUMN public.permissions.principal_type IS 'Type of principal: ''user'' (auth.users.id), ''team'' (teams.id in Phase 2), ''api_key'' (api_keys.id in Phase 3)';
COMMENT ON COLUMN public.permissions.principal_id IS 'ID of the principal (user, team, or api_key) receiving the permission';
COMMENT ON COLUMN public.permissions.role_id IS 'Role assigned to the principal for this object';
COMMENT ON COLUMN public.permissions.object_type IS 'Type of object: organization, workspace, project, task';
COMMENT ON COLUMN public.permissions.object_id IS 'Specific object ID. NULL means permission applies to all objects of this type, non-null means specific object only.';
COMMENT ON COLUMN public.permissions.deleted_at IS 'Soft delete timestamp. NULL means active, non-null means deleted.';

-- Function comments
COMMENT ON FUNCTION public.refresh_member_views() IS 'Trigger function that intelligently refreshes only the materialized view affected by permission changes based on object_type.';
