-- =====================================================
-- ADD OWNER/ADMIN ORG-WIDE ACCESS
-- =====================================================

DROP POLICY IF EXISTS "select_permissions" ON public.permissions;
DROP POLICY IF EXISTS "select_workspaces" ON public.workspaces;

-- =====================================================
-- PERMISSIONS TABLE - Owner/Admin see ALL in their org
-- =====================================================
CREATE POLICY "select_permissions" ON public.permissions
  FOR SELECT TO authenticated
  USING (
    -- 1. Users see their own permissions
    (principal_type = 'user' AND principal_id = auth.uid())
    OR
    -- 2. Owner/Admin of org can see ALL permissions in that org
    org_id IN (
      SELECT p.object_id
      FROM public.permissions p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.principal_type = 'user'
        AND p.principal_id = auth.uid()
        AND p.object_type = 'organization'
        AND r.name IN ('owner', 'admin')
        AND p.deleted_at IS NULL
        AND r.deleted_at IS NULL
    )
  );

COMMENT ON POLICY "select_permissions" ON public.permissions IS 'Users see own permissions, or all permissions in orgs they own/admin';

-- =====================================================
-- WORKSPACES TABLE - Owner/Admin see ALL in their org
-- =====================================================
CREATE POLICY "select_workspaces" ON public.workspaces
  FOR SELECT TO authenticated
  USING (
    -- 1. Direct workspace permission
    id IN (
      SELECT object_id
      FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND object_type = 'workspace'
        AND deleted_at IS NULL
    )
    OR
    -- 2. Owner/Admin of org can see ALL workspaces in that org
    organization_id IN (
      SELECT p.object_id
      FROM public.permissions p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.principal_type = 'user'
        AND p.principal_id = auth.uid()
        AND p.object_type = 'organization'
        AND r.name IN ('owner', 'admin')
        AND p.deleted_at IS NULL
        AND r.deleted_at IS NULL
    )
  );

COMMENT ON POLICY "select_workspaces" ON public.workspaces IS 'Users see workspaces they have access to, or all workspaces in orgs they own/admin';
