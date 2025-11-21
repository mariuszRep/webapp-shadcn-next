-- =====================================================
-- FIX ROLES SELECT POLICY
-- =====================================================
-- Users should see: system roles + roles in their orgs

DROP POLICY IF EXISTS "select_roles" ON public.roles;

CREATE POLICY "select_roles" ON public.roles
  FOR SELECT TO authenticated
  USING (
    -- 1. System roles (org_id IS NULL) are visible to all authenticated users
    org_id IS NULL
    OR
    -- 2. Org-specific roles: visible if user has any permission in that org
    org_id IN (
      SELECT DISTINCT org_id
      FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND deleted_at IS NULL
    )
  );

COMMENT ON POLICY "select_roles" ON public.roles IS 'Users see system roles and all roles in organizations they belong to';
