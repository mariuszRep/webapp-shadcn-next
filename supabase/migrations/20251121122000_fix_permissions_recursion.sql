-- =====================================================
-- CREATE HELPER FUNCTIONS TO AVOID RECURSION
-- =====================================================

-- Get organization IDs where user has any permission (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_org_ids(check_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT ARRAY_AGG(DISTINCT object_id)
  FROM public.permissions
  WHERE principal_type = 'user'
    AND principal_id = check_user_id
    AND object_type = 'organization'
    AND deleted_at IS NULL
    AND object_id IS NOT NULL;
$$;

COMMENT ON FUNCTION public.get_user_org_ids IS 'Get organization IDs where user has permissions. Bypasses RLS to avoid recursion.';

-- =====================================================
-- FIX PERMISSIONS POLICY TO USE SECURITY DEFINER
-- =====================================================

DROP POLICY IF EXISTS "select_permissions" ON public.permissions;

CREATE POLICY "select_permissions" ON public.permissions
  FOR SELECT TO authenticated
  USING (
    -- Regular users: see only their own permissions
    (
      principal_type = 'user'
      AND principal_id = auth.uid()
    )
    OR
    -- Owner/Admin: see all permissions in their organizations
    (
      -- For organization-level permissions
      (
        object_type = 'organization'
        AND object_id = ANY(public.get_user_org_ids(auth.uid()))
        AND public.user_has_role_on_object(auth.uid(), 'organization', object_id, ARRAY['owner', 'admin'])
      )
      OR
      -- For workspace-level permissions
      (
        object_type = 'workspace'
        AND EXISTS (
          SELECT 1
          FROM public.workspaces w
          WHERE w.id = object_id
            AND w.organization_id = ANY(public.get_user_org_ids(auth.uid()))
            AND public.user_has_role_on_object(auth.uid(), 'organization', w.organization_id, ARRAY['owner', 'admin'])
        )
      )
    )
  );

COMMENT ON POLICY "select_permissions" ON public.permissions IS 'Users see their own permissions; owner/admin see all permissions in their organizations';
