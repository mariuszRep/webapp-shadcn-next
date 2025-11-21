-- =====================================================
-- ADD INSERT/UPDATE/DELETE POLICIES FOR PERMISSIONS TABLE
-- =====================================================

-- =====================================================
-- PERMISSIONS TABLE - INSERT POLICY
-- =====================================================
CREATE POLICY "insert_permissions" ON public.permissions
  FOR INSERT TO authenticated
  WITH CHECK (
    -- User must have "insert" permission on the target object
    EXISTS (
      SELECT 1
      FROM public.permissions p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.principal_type = 'user'
        AND p.principal_id = auth.uid()
        AND p.object_type = permissions.object_type
        AND (p.object_id IS NULL OR p.object_id = permissions.object_id)
        AND r.permissions ? 'insert'
        AND p.deleted_at IS NULL
        AND r.deleted_at IS NULL
    )
  );

COMMENT ON POLICY "insert_permissions" ON public.permissions IS 'Users can create permissions if they have insert rights on the target object';

-- =====================================================
-- PERMISSIONS TABLE - UPDATE POLICY
-- =====================================================
CREATE POLICY "update_permissions" ON public.permissions
  FOR UPDATE TO authenticated
  USING (
    -- User must have "update" permission on the target object
    EXISTS (
      SELECT 1
      FROM public.permissions p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.principal_type = 'user'
        AND p.principal_id = auth.uid()
        AND p.object_type = permissions.object_type
        AND (p.object_id IS NULL OR p.object_id = permissions.object_id)
        AND r.permissions ? 'update'
        AND p.deleted_at IS NULL
        AND r.deleted_at IS NULL
    )
  )
  WITH CHECK (
    -- Ensure they still have update permission after the change
    EXISTS (
      SELECT 1
      FROM public.permissions p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.principal_type = 'user'
        AND p.principal_id = auth.uid()
        AND p.object_type = permissions.object_type
        AND (p.object_id IS NULL OR p.object_id = permissions.object_id)
        AND r.permissions ? 'update'
        AND p.deleted_at IS NULL
        AND r.deleted_at IS NULL
    )
  );

COMMENT ON POLICY "update_permissions" ON public.permissions IS 'Users can update permissions if they have update rights on the target object';

-- =====================================================
-- PERMISSIONS TABLE - DELETE POLICY
-- =====================================================
CREATE POLICY "delete_permissions" ON public.permissions
  FOR DELETE TO authenticated
  USING (
    -- User must have "delete" permission on the target object
    EXISTS (
      SELECT 1
      FROM public.permissions p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.principal_type = 'user'
        AND p.principal_id = auth.uid()
        AND p.object_type = permissions.object_type
        AND (p.object_id IS NULL OR p.object_id = permissions.object_id)
        AND r.permissions ? 'delete'
        AND p.deleted_at IS NULL
        AND r.deleted_at IS NULL
    )
  );

COMMENT ON POLICY "delete_permissions" ON public.permissions IS 'Users can delete permissions if they have delete rights on the target object';
