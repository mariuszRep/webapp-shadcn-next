-- =====================================================
-- RESTRICT ROLES VISIBILITY TO OWNER/ADMIN
-- =====================================================

DROP POLICY IF EXISTS "select_roles" ON public.roles;

CREATE POLICY "select_roles" ON public.roles
  FOR SELECT TO authenticated
  USING (
    -- 1. Regular users: see only roles they've been assigned
    id IN (
      SELECT role_id
      FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND deleted_at IS NULL
    )
    OR
    -- 2. Owner/Admin: see system roles + org roles (check via role_id)
    (
      (
        -- System roles (org_id IS NULL)
        org_id IS NULL
        OR
        -- Org-specific roles in orgs where user has owner/admin role
        org_id IN (
          SELECT p.object_id
          FROM public.permissions p
          WHERE p.principal_type = 'user'
            AND p.principal_id = auth.uid()
            AND p.object_type = 'organization'
            -- Check if role_id is owner or admin (by UUID)
            AND p.role_id IN (
              '6a31c964-c706-4654-b2bb-3458a11bfcfc', -- owner
              '53a238b2-9d0e-4686-89aa-3d45c6ed4607'  -- admin
            )
            AND p.deleted_at IS NULL
        )
      )
      AND EXISTS (
        SELECT 1
        FROM public.permissions p
        WHERE p.principal_type = 'user'
          AND p.principal_id = auth.uid()
          AND p.object_type = 'organization'
          AND p.role_id IN (
            '6a31c964-c706-4654-b2bb-3458a11bfcfc', -- owner
            '53a238b2-9d0e-4686-89aa-3d45c6ed4607'  -- admin
          )
          AND p.deleted_at IS NULL
      )
    )
  );

COMMENT ON POLICY "select_roles" ON public.roles IS 'Regular users see their assigned roles; owner/admin see all roles (system + org)';
