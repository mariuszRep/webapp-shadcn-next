-- Final fix: Disable auto-provisioning completely
-- This migration ensures handle_new_user does NOT create Personal org/workspace
-- Users must go through the onboarding flow instead

-- Replace handle_new_user with a no-op version
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  -- No-op: Just return NEW without creating organization or workspace
  -- This allows new users to go through the onboarding flow
  RETURN NEW;
END;
$$;

-- Update comment to reflect the change
COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function for new users - disabled to enable onboarding flow. Users create organizations through onboarding wizard.';
