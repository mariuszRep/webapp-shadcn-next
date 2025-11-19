-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "allow_create_organizations" ON public.organizations;
DROP POLICY IF EXISTS "allow_view_organizations" ON public.organizations;
DROP POLICY IF EXISTS "allow_update_organizations" ON public.organizations;
DROP POLICY IF EXISTS "allow_delete_organizations" ON public.organizations;

-- Policy: Allow authenticated users to create organizations
CREATE POLICY "allow_create_organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Policy: Allow users to view organizations they belong to OR created
-- We need to check created_by because the permission record might not exist yet
-- during the initial creation transaction
CREATE POLICY "allow_view_organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
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
  (created_by = auth.uid()) -- Fallback for creator
  OR EXISTS (
    SELECT 1
    FROM public.users_permissions up
    WHERE up.object_id = organizations.id
      AND up.object_type = 'organization'
      AND up.user_id = auth.uid()
      AND up.role_name IN ('owner', 'admin')
  )
)
WITH CHECK (
  (created_by = auth.uid()) -- Fallback for creator
  OR EXISTS (
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
  (created_by = auth.uid()) -- Fallback for creator
  OR EXISTS (
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
COMMENT ON POLICY "allow_view_organizations" ON public.organizations IS 'Users can view organizations they created or are members of';
COMMENT ON POLICY "allow_update_organizations" ON public.organizations IS 'Owners and admins can update organization details';
COMMENT ON POLICY "allow_delete_organizations" ON public.organizations IS 'Only owners can delete organizations';
