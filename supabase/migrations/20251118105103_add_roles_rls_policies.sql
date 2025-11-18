-- =====================================================
-- ROLES TABLE RLS POLICIES
-- =====================================================
-- Enable RLS on roles table
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to view all system-wide roles (org_id IS NULL)
CREATE POLICY "allow_view_system_roles"
ON public.roles
FOR SELECT
TO authenticated
USING (org_id IS NULL AND deleted_at IS NULL);

-- Policy: Allow users to view roles in organizations they belong to
CREATE POLICY "allow_view_org_roles"
ON public.roles
FOR SELECT
TO authenticated
USING (
  org_id IS NOT NULL
  AND deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.organization_members_view omv
    WHERE omv.org_id = roles.org_id
      AND omv.user_id = auth.uid()
  )
);

-- Policy: Allow organization owners and admins to create roles
CREATE POLICY "allow_create_org_roles"
ON public.roles
FOR INSERT
TO authenticated
WITH CHECK (
  org_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.organization_members_view omv
    WHERE omv.org_id = roles.org_id
      AND omv.user_id = auth.uid()
      AND omv.role_name IN ('owner', 'admin')
  )
);

-- Policy: Allow organization owners and admins to update roles
CREATE POLICY "allow_update_org_roles"
ON public.roles
FOR UPDATE
TO authenticated
USING (
  org_id IS NOT NULL
  AND deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.organization_members_view omv
    WHERE omv.org_id = roles.org_id
      AND omv.user_id = auth.uid()
      AND omv.role_name IN ('owner', 'admin')
  )
)
WITH CHECK (
  org_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.organization_members_view omv
    WHERE omv.org_id = roles.org_id
      AND omv.user_id = auth.uid()
      AND omv.role_name IN ('owner', 'admin')
  )
);

-- Policy: Allow organization owners and admins to soft-delete roles
-- (They can update deleted_at field)
CREATE POLICY "allow_delete_org_roles"
ON public.roles
FOR DELETE
TO authenticated
USING (
  org_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.organization_members_view omv
    WHERE omv.org_id = roles.org_id
      AND omv.user_id = auth.uid()
      AND omv.role_name IN ('owner', 'admin')
  )
);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON POLICY "allow_view_system_roles" ON public.roles IS 'All authenticated users can view system-wide roles (org_id IS NULL)';
COMMENT ON POLICY "allow_view_org_roles" ON public.roles IS 'Users can view roles in organizations they belong to';
COMMENT ON POLICY "allow_create_org_roles" ON public.roles IS 'Only organization owners and admins can create roles';
COMMENT ON POLICY "allow_update_org_roles" ON public.roles IS 'Only organization owners and admins can update roles';
COMMENT ON POLICY "allow_delete_org_roles" ON public.roles IS 'Only organization owners and admins can delete roles';
