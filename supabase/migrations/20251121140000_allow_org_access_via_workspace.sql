-- =====================================================
-- ALLOW ORGANIZATION ACCESS VIA WORKSPACE PERMISSION
-- =====================================================
-- Users should see organizations if they have:
-- 1. Direct organization permission, OR
-- 2. Direct workspace permission in that organization

DROP POLICY IF EXISTS "select_organizations" ON public.organizations;

CREATE POLICY "select_organizations" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    -- Direct organization permission
    id IN (
      SELECT org_id
      FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND object_type IN ('organization', 'workspace')
        AND deleted_at IS NULL
    )
  );

COMMENT ON POLICY "select_organizations" ON public.organizations IS 'Users can see organizations they have direct permissions on OR organizations containing workspaces they have access to';
