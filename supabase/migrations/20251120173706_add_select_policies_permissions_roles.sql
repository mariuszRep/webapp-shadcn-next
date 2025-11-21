-- =====================================================
-- ENABLE RLS AND ADD SELECT POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 1. ROLES TABLE - SELECT POLICY
-- =====================================================
-- Users see roles they have been assigned
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

-- =====================================================
-- 2. PERMISSIONS TABLE - SELECT POLICY
-- =====================================================
-- Users see their own permission records
CREATE POLICY "select_permissions" ON public.permissions
  FOR SELECT TO authenticated
  USING (
    principal_type = 'user'
    AND principal_id = auth.uid()
  );

COMMENT ON POLICY "select_permissions" ON public.permissions IS 'Users can see their own permissions';

-- =====================================================
-- 3. ORGANIZATIONS TABLE - SELECT POLICY
-- =====================================================
-- Users see organizations where they have explicit permissions
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

-- =====================================================
-- 4. WORKSPACES TABLE - SELECT POLICY
-- =====================================================
-- Users see workspaces with direct permission OR inherited from organization
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
