-- =====================================================
-- CREATE GENERAL PERMISSION CHECKING FUNCTION
-- =====================================================

-- General function to check if user has specific role(s) on an object
CREATE OR REPLACE FUNCTION public.user_has_role_on_object(
  check_user_id uuid,
  check_object_type text,
  check_object_id uuid,
  check_role_names text[]
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.permissions p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.principal_type = 'user'
      AND p.principal_id = check_user_id
      AND p.object_type = check_object_type
      AND (check_object_id IS NULL OR p.object_id = check_object_id)
      AND r.name = ANY(check_role_names)
      AND p.deleted_at IS NULL
      AND r.deleted_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.user_has_role_on_object IS 'General function to check if user has specific role(s) on an object. Bypasses RLS to avoid recursion.';

-- =====================================================
-- UPDATE ROLES POLICY TO USE GENERAL FUNCTION
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
