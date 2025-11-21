-- =====================================================
-- CREATE HELPER FUNCTION TO GET USER'S ROLE IDS
-- =====================================================

-- Function to get role IDs assigned to a user (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_role_ids(check_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT ARRAY_AGG(DISTINCT role_id)
  FROM public.permissions
  WHERE principal_type = 'user'
    AND principal_id = check_user_id
    AND deleted_at IS NULL;
$$;

COMMENT ON FUNCTION public.get_user_role_ids IS 'Get role IDs assigned to a user. Bypasses RLS to avoid recursion.';

-- Function to get organization IDs where user has permissions (bypasses RLS)
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
    AND deleted_at IS NULL;
$$;

COMMENT ON FUNCTION public.get_user_org_ids IS 'Get organization IDs where user has permissions. Bypasses RLS to avoid recursion.';

-- =====================================================
-- UPDATE ROLES POLICY TO USE SECURITY DEFINER FUNCTIONS
-- =====================================================

DROP POLICY IF EXISTS "select_roles" ON public.roles;

CREATE POLICY "select_roles" ON public.roles
  FOR SELECT TO authenticated
  USING (
    -- 1. Regular users: see only roles they've been assigned
    id = ANY(public.get_user_role_ids(auth.uid()))
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
          SELECT object_id
          FROM public.permissions
          WHERE principal_type = 'user'
            AND principal_id = auth.uid()
            AND object_type = 'organization'
            AND deleted_at IS NULL
        )
      )
    )
  );

COMMENT ON POLICY "select_roles" ON public.roles IS 'Regular users see their assigned roles; owner/admin see all roles (system + org)';
