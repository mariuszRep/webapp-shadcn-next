-- =====================================================
-- UPDATE PERMISSIONS POLICY FOR OWNER/ADMIN ACCESS
-- =====================================================
-- Regular users see only their own permissions
-- Owner/Admin see all permissions in their organizations

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
        AND object_id IN (
          SELECT p.object_id
          FROM public.permissions p
          WHERE p.principal_type = 'user'
            AND p.principal_id = auth.uid()
            AND p.object_type = 'organization'
            AND p.deleted_at IS NULL
        )
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
            AND public.user_has_role_on_object(auth.uid(), 'organization', w.organization_id, ARRAY['owner', 'admin'])
        )
      )
    )
  );

COMMENT ON POLICY "select_permissions" ON public.permissions IS 'Users see their own permissions; owner/admin see all permissions in their organizations';
