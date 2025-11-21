-- =====================================================
-- ROLLBACK ORG-WIDE ACCESS (RESTORE SIMPLE POLICIES)
-- =====================================================

DROP POLICY IF EXISTS "select_permissions" ON public.permissions;
DROP POLICY IF EXISTS "select_workspaces" ON public.workspaces;

-- Restore simple working policies
CREATE POLICY "select_permissions" ON public.permissions
  FOR SELECT TO authenticated
  USING (
    principal_type = 'user'
    AND principal_id = auth.uid()
  );

COMMENT ON POLICY "select_permissions" ON public.permissions IS 'Users can see their own permissions';

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
