-- =====================================================
-- REVERT TO WORKING STATE (20251120173706)
-- =====================================================
-- This migration undoes all changes after 20251120173706_add_select_policies_permissions_roles.sql

-- 1. Drop all policies (will recreate the correct ones)
-- -----------------------------------------------------
DROP POLICY IF EXISTS "select_roles" ON public.roles;
DROP POLICY IF EXISTS "select_permissions" ON public.permissions;
DROP POLICY IF EXISTS "select_organizations" ON public.organizations;
DROP POLICY IF EXISTS "select_workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "insert_permissions" ON public.permissions;
DROP POLICY IF EXISTS "update_permissions" ON public.permissions;
DROP POLICY IF EXISTS "delete_permissions" ON public.permissions;

-- 2. Fix permissions table structure
-- -----------------------------------------------------
-- Ensure org_id is NOT NULL
ALTER TABLE public.permissions ALTER COLUMN org_id SET NOT NULL;

-- Ensure object_type constraint is correct
ALTER TABLE public.permissions DROP CONSTRAINT IF EXISTS chk_object_type;
ALTER TABLE public.permissions ADD CONSTRAINT chk_object_type
  CHECK (object_type IN ('organization', 'workspace'));

-- 3. Fix users_permissions view
-- -----------------------------------------------------
DROP VIEW IF EXISTS public.users_permissions CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.users_permissions CASCADE;

CREATE OR REPLACE VIEW public.users_permissions AS
SELECT DISTINCT
    p.org_id,
    p.object_type,
    p.object_id,
    p.principal_id AS user_id,
    p.role_id,
    r.name AS role_name,
    r.permissions AS role_permissions
FROM public.permissions p
JOIN public.roles r ON p.role_id = r.id
WHERE p.principal_type = 'user'
  AND p.deleted_at IS NULL
  AND r.deleted_at IS NULL
  AND p.object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_permissions_principal_user
ON public.permissions(principal_id, principal_type)
WHERE principal_type = 'user' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_permissions_object_lookup
ON public.permissions(object_type, object_id, deleted_at)
WHERE deleted_at IS NULL;

-- 4. Enable RLS on all tables
-- -----------------------------------------------------
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- 5. Recreate ONLY the SELECT policies from 20251120173706
-- -----------------------------------------------------

-- ROLES TABLE
CREATE POLICY "select_roles" ON public.roles
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT role_id
      FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND deleted_at IS NULL
    )
  );

COMMENT ON POLICY "select_roles" ON public.roles IS 'Users can see roles they have been assigned';

-- PERMISSIONS TABLE
CREATE POLICY "select_permissions" ON public.permissions
  FOR SELECT TO authenticated
  USING (
    principal_type = 'user'
    AND principal_id = auth.uid()
  );

COMMENT ON POLICY "select_permissions" ON public.permissions IS 'Users can see their own permissions';

-- ORGANIZATIONS TABLE
CREATE POLICY "select_organizations" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT object_id
      FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND object_type = 'organization'
        AND deleted_at IS NULL
    )
  );

COMMENT ON POLICY "select_organizations" ON public.organizations IS 'Users can see organizations they have permissions on';

-- WORKSPACES TABLE
CREATE POLICY "select_workspaces" ON public.workspaces
  FOR SELECT TO authenticated
  USING (
    -- Direct workspace permission
    id IN (
      SELECT object_id
      FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND object_type = 'workspace'
        AND deleted_at IS NULL
    )
    OR
    -- Inherited from organization
    organization_id IN (
      SELECT object_id
      FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND object_type = 'organization'
        AND deleted_at IS NULL
    )
  );

COMMENT ON POLICY "select_workspaces" ON public.workspaces IS 'Users can see workspaces they have direct access to or inherit from organization';
