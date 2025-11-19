-- Enable RLS on organizations table
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to create organizations
-- Users can create an organization if they are authenticated
CREATE POLICY "allow_create_organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Allow users to view organizations they belong to
CREATE POLICY "allow_view_organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users_permissions up
    WHERE up.object_id = organizations.id
      AND up.object_type = 'organization'
      AND up.user_id = auth.uid()
  )
);

-- Policy: Allow organization owners and admins to update their organizations
CREATE POLICY "allow_update_organizations"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users_permissions up
    WHERE up.object_id = organizations.id
      AND up.object_type = 'organization'
      AND up.user_id = auth.uid()
      AND up.role_name IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_permissions up
    WHERE up.object_id = organizations.id
      AND up.object_type = 'organization'
      AND up.user_id = auth.uid()
      AND up.role_name IN ('owner', 'admin')
  )
);

-- Policy: Allow organization owners to delete their organizations
CREATE POLICY "allow_delete_organizations"
ON public.organizations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users_permissions up
    WHERE up.object_id = organizations.id
      AND up.object_type = 'organization'
      AND up.user_id = auth.uid()
      AND up.role_name = 'owner'
  )
);

-- Comments
COMMENT ON POLICY "allow_create_organizations" ON public.organizations IS 'Authenticated users can create new organizations';
COMMENT ON POLICY "allow_view_organizations" ON public.organizations IS 'Users can view organizations they are members of';
COMMENT ON POLICY "allow_update_organizations" ON public.organizations IS 'Owners and admins can update organization details';
COMMENT ON POLICY "allow_delete_organizations" ON public.organizations IS 'Only owners can delete organizations';
