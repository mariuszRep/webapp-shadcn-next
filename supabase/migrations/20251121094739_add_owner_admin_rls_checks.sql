-- =====================================================
-- ADD OWNER/ADMIN CHECKS TO RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "select_permissions" ON public.permissions;
DROP POLICY IF EXISTS "select_workspaces" ON public.workspaces;

-- =====================================================
-- PERMISSIONS TABLE - UPDATED SELECT POLICY
-- =====================================================
CREATE POLICY "select_permissions" ON public.permissions
  FOR SELECT TO authenticated
  USING (
    -- 1. User can see their own permissions
    (principal_type = 'user' AND principal_id = auth.uid())
    OR
    -- 2. User can see all permissions in workspaces they have access to
    (object_type = 'workspace' AND object_id IN (
      SELECT object_id
      FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND object_type = 'workspace'
        AND deleted_at IS NULL
    ))
    OR
    -- 3. Owner/Admin at org level can see ALL permissions in their org
    org_id IN (
      SELECT p.object_id
      FROM public.permissions p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.principal_type = 'user'
        AND p.principal_id = auth.uid()
        AND p.object_type = 'organization'
        AND r.name IN ('Owner', 'Admin')
        AND p.deleted_at IS NULL
        AND r.deleted_at IS NULL
    )
  );

COMMENT ON POLICY "select_permissions" ON public.permissions IS 'Users see own permissions, workspace permissions, or all org permissions if Owner/Admin';

-- =====================================================
-- WORKSPACES TABLE - UPDATED SELECT POLICY
-- =====================================================
CREATE POLICY "select_workspaces" ON public.workspaces
  FOR SELECT TO authenticated
  USING (
    -- 1. Direct workspace permission (specific workspace)
    id IN (
      SELECT object_id
      FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND object_type = 'workspace'
        AND object_id IS NOT NULL
        AND deleted_at IS NULL
    )
    OR
    -- 2. Global workspace permission (object_id IS NULL = all workspaces in org)
    organization_id IN (
      SELECT org_id
      FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND object_type = 'workspace'
        AND object_id IS NULL
        AND deleted_at IS NULL
    )
    OR
    -- 3. Inherited from organization (Owner/Admin only)
    organization_id IN (
      SELECT p.object_id
      FROM public.permissions p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.principal_type = 'user'
        AND p.principal_id = auth.uid()
        AND p.object_type = 'organization'
        AND r.name IN ('Owner', 'Admin')
        AND p.deleted_at IS NULL
        AND r.deleted_at IS NULL
    )
  );

COMMENT ON POLICY "select_workspaces" ON public.workspaces IS 'Users see workspaces with direct access, global workspace access, or org inheritance (Owner/Admin only)';
