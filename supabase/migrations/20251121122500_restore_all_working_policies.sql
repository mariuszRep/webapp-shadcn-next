-- =====================================================
-- RESTORE ALL WORKING POLICIES
-- =====================================================
-- Rollback ALL the breaking changes and restore exact working state

-- PERMISSIONS TABLE - Simple policy (users see only their own)
DROP POLICY IF EXISTS "select_permissions" ON public.permissions;

CREATE POLICY "select_permissions" ON public.permissions
  FOR SELECT TO authenticated
  USING (
    principal_type = 'user'
    AND principal_id = auth.uid()
  );

COMMENT ON POLICY "select_permissions" ON public.permissions IS 'Users can see their own permissions';

-- ROLES TABLE - Working policy with function
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
    -- 2. Owner/Admin: see ALL roles (system + org roles)
    (
      -- Check if user is owner or admin of ANY organization
      public.user_has_role_on_object(auth.uid(), 'organization', NULL, ARRAY['owner', 'admin'])
      AND (
        -- System roles (org_id IS NULL)
        org_id IS NULL
        OR
        -- Org-specific roles in their orgs
        org_id IN (
          SELECT p.object_id
          FROM public.permissions p
          WHERE p.principal_type = 'user'
            AND p.principal_id = auth.uid()
            AND p.object_type = 'organization'
            AND p.deleted_at IS NULL
        )
      )
    )
  );

COMMENT ON POLICY "select_roles" ON public.roles IS 'Regular users see their assigned roles; owner/admin see all roles (system + org)';

-- ORGANIZATIONS TABLE
DROP POLICY IF EXISTS "select_organizations" ON public.organizations;

CREATE POLICY "select_organizations" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT object_id
      FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND object_type = 'organization'
        AND deleted_at IS NULL
    )
  );

COMMENT ON POLICY "select_organizations" ON public.organizations IS 'Users can see organizations they have permissions on';

-- WORKSPACES TABLE
DROP POLICY IF EXISTS "select_workspaces" ON public.workspaces;

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
