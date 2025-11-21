-- =====================================================
-- ADD OWNER/ADMIN SELECT PRIVILEGES
-- =====================================================

-- Drop existing policies to recreate with Owner/Admin checks
DROP POLICY IF EXISTS "select_permissions" ON public.permissions;
DROP POLICY IF EXISTS "select_workspaces" ON public.workspaces;

-- =====================================================
-- PERMISSIONS TABLE - Enhanced SELECT with Owner/Admin
-- =====================================================
CREATE POLICY "select_permissions" ON public.permissions
  FOR SELECT TO authenticated
  USING (
    -- 1. Users can see their own permissions
    (principal_type = 'user' AND principal_id = auth.uid())
    OR
    -- 2. Users with 'select' permission on the target object can see those permissions
    EXISTS (
      SELECT 1
      FROM public.permissions my_perms
      JOIN public.roles r ON my_perms.role_id = r.id
      WHERE my_perms.principal_type = 'user'
        AND my_perms.principal_id = auth.uid()
        AND my_perms.object_type = permissions.object_type
        AND (my_perms.object_id IS NULL OR my_perms.object_id = permissions.object_id)
        AND r.permissions ? 'select'
        AND my_perms.deleted_at IS NULL
        AND r.deleted_at IS NULL
    )
  );

COMMENT ON POLICY "select_permissions" ON public.permissions IS 'Users see own permissions or can see permissions on objects they have select rights for';

-- =====================================================
-- WORKSPACES TABLE - Enhanced SELECT with Owner/Admin
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
    -- 3. Inherited from organization (users with org permission see all workspaces)
    organization_id IN (
      SELECT object_id
      FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND object_type = 'organization'
        AND deleted_at IS NULL
    )
  );

COMMENT ON POLICY "select_workspaces" ON public.workspaces IS 'Users see workspaces with direct access, global workspace access, or inherited from organization';
