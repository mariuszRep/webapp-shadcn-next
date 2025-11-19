-- Remove automatic Personal org/workspace creation from handle_new_user
-- Users should go through the onboarding flow instead
-- This migration completely removes the auto-provisioning logic

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Remove the handle_new_user function entirely since it's no longer needed
-- The onboarding flow will handle organization and workspace creation
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Add comment explaining the change
COMMENT ON SCHEMA public IS 'Auto-provisioning removed. Users go through onboarding flow to create organizations and workspaces. Ownership is automatically assigned via triggers on organizations and workspaces tables.';
