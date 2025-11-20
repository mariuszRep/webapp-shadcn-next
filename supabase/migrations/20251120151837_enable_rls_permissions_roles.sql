-- =====================================================
-- ENABLE RLS AND CREATE POLICIES FOR PERMISSIONS AND ROLES
-- =====================================================
-- This migration enables Row Level Security on permissions and roles tables
-- and creates policies for fine-grained access control.

-- =====================================================
-- HELPER FUNCTION
-- =====================================================
-- Create a helper function to check if a user has a specific role
-- This avoids recursion issues in RLS policies by querying directly
CREATE OR REPLACE FUNCTION public.has_role(
  user_id uuid,
  check_org_id uuid,
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
      AND p.principal_id = user_id
      AND p.org_id = check_org_id
      AND p.object_type = 'organization'
      AND p.object_id = check_org_id
      AND r.name = ANY(check_role_names)
      AND p.deleted_at IS NULL
      AND r.deleted_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.has_role IS 'Check if a user has any of the specified roles in an organization. Used in RLS policies to avoid recursion.';

-- =====================================================
-- ENABLE RLS
-- =====================================================
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PERMISSIONS TABLE POLICIES
-- =====================================================

-- SELECT: Users can view permissions in organizations they belong to
CREATE POLICY "permissions_select_policy" ON public.permissions
  FOR SELECT TO authenticated
  USING (
    -- User can see permissions in their organizations
    EXISTS (
      SELECT 1
      FROM public.users_permissions up
      WHERE up.org_id = permissions.org_id
        AND up.user_id = auth.uid()
        AND up.object_type = 'organization'
    )
  );

-- INSERT: Only organization admins/owners can create permissions
CREATE POLICY "permissions_insert_policy" ON public.permissions
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Must be admin or owner of the organization
    public.has_role(auth.uid(), org_id, ARRAY['Admin', 'Owner'])
  );

-- UPDATE: Only organization admins/owners can update permissions
CREATE POLICY "permissions_update_policy" ON public.permissions
  FOR UPDATE TO authenticated
  USING (
    -- Must be admin or owner of the organization
    public.has_role(auth.uid(), org_id, ARRAY['Admin', 'Owner'])
  )
  WITH CHECK (
    -- Ensure org_id doesn't change or user remains admin/owner
    public.has_role(auth.uid(), org_id, ARRAY['Admin', 'Owner'])
  );

-- DELETE: Only organization admins/owners can delete permissions
CREATE POLICY "permissions_delete_policy" ON public.permissions
  FOR DELETE TO authenticated
  USING (
    -- Must be admin or owner of the organization
    public.has_role(auth.uid(), org_id, ARRAY['Admin', 'Owner'])
  );

-- =====================================================
-- ROLES TABLE POLICIES
-- =====================================================

-- SELECT: Users can view system roles and roles in their organizations
CREATE POLICY "roles_select_policy" ON public.roles
  FOR SELECT TO authenticated
  USING (
    -- System roles (org_id IS NULL) are visible to all authenticated users
    org_id IS NULL
    OR
    -- Organization-specific roles are visible to members of that organization
    EXISTS (
      SELECT 1
      FROM public.users_permissions up
      WHERE up.org_id = roles.org_id
        AND up.user_id = auth.uid()
        AND up.object_type = 'organization'
    )
  );

-- INSERT: Only organization admins/owners can create org-specific roles
CREATE POLICY "roles_insert_policy" ON public.roles
  FOR INSERT TO authenticated
  WITH CHECK (
    -- System roles cannot be created (org_id must not be null)
    org_id IS NOT NULL
    AND
    -- Must be admin or owner of the organization
    public.has_role(auth.uid(), org_id, ARRAY['Admin', 'Owner'])
  );

-- UPDATE: Only organization admins/owners can update org-specific roles
CREATE POLICY "roles_update_policy" ON public.roles
  FOR UPDATE TO authenticated
  USING (
    -- System roles cannot be updated
    org_id IS NOT NULL
    AND
    -- Must be admin or owner of the organization
    public.has_role(auth.uid(), org_id, ARRAY['Admin', 'Owner'])
  )
  WITH CHECK (
    -- Ensure org_id doesn't change and user remains admin/owner
    org_id IS NOT NULL
    AND
    public.has_role(auth.uid(), org_id, ARRAY['Admin', 'Owner'])
  );

-- DELETE: Only organization admins/owners can delete org-specific roles
CREATE POLICY "roles_delete_policy" ON public.roles
  FOR DELETE TO authenticated
  USING (
    -- System roles cannot be deleted
    org_id IS NOT NULL
    AND
    -- Must be admin or owner of the organization
    public.has_role(auth.uid(), org_id, ARRAY['Admin', 'Owner'])
  );

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON POLICY "permissions_select_policy" ON public.permissions IS 'Users can view permissions in organizations they belong to';
COMMENT ON POLICY "permissions_insert_policy" ON public.permissions IS 'Only organization admins/owners can create permissions';
COMMENT ON POLICY "permissions_update_policy" ON public.permissions IS 'Only organization admins/owners can update permissions';
COMMENT ON POLICY "permissions_delete_policy" ON public.permissions IS 'Only organization admins/owners can delete permissions';

COMMENT ON POLICY "roles_select_policy" ON public.roles IS 'Users can view system roles and roles in their organizations';
COMMENT ON POLICY "roles_insert_policy" ON public.roles IS 'Only organization admins/owners can create org-specific roles';
COMMENT ON POLICY "roles_update_policy" ON public.roles IS 'Only organization admins/owners can update org-specific roles';
COMMENT ON POLICY "roles_delete_policy" ON public.roles IS 'Only organization admins/owners can delete org-specific roles';
