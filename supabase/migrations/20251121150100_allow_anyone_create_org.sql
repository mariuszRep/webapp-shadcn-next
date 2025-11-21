-- =====================================================
-- UPDATE INSERT POLICY - ALLOW ANYONE TO CREATE ORGANIZATIONS
-- =====================================================
-- Replace the restrictive INSERT policy with one that allows any authenticated user
-- to create organizations (owner role will be assigned via trigger)

DROP POLICY IF EXISTS "Users can create orgs with permission" ON public.organizations;

CREATE POLICY "Users can create orgs" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Allow any authenticated user to create an organization
    -- The assign_ownership trigger will automatically grant owner role
    auth.uid() = created_by
  );

COMMENT ON POLICY "Users can create orgs" ON public.organizations IS 'Any authenticated user can create organizations. Owner role is automatically assigned via trigger.';
