-- =====================================================
-- SIMPLIFY INSERT POLICY - ALLOW ANY AUTHENTICATED USER
-- =====================================================
-- Remove the created_by check since it can cause issues with server-side auth context
-- The assign_ownership trigger will handle permission assignment automatically

DROP POLICY IF EXISTS "Users can create orgs" ON public.organizations;

CREATE POLICY "Users can create orgs" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (true);

COMMENT ON POLICY "Users can create orgs" ON public.organizations IS 'Any authenticated user can create organizations. Owner role is automatically assigned via assign_ownership trigger.';
