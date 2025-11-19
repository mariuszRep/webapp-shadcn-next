-- Modify trigger function to disable auto-provisioning
-- This keeps the trigger structure intact for potential future use
-- but removes the automatic creation of Personal organization and workspace
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
COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function for new users - currently disabled to enable onboarding flow';
