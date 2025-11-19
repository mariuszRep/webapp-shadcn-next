-- Fix handle_new_user to prevent duplicate permission creation
-- The new ownership triggers handle permission assignment automatically
-- This migration removes the manual permission inserts from handle_new_user

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  new_org_id UUID;
  new_workspace_id UUID;
BEGIN
  -- Insert personal organization
  -- The trg_assign_ownership_organizations trigger will automatically create the owner permission
  INSERT INTO public.organizations (name, created_by, updated_by)
  VALUES ('Personal', NEW.id, NEW.id)
  RETURNING id INTO new_org_id;

  -- Insert personal workspace
  -- The trg_assign_ownership_workspaces trigger will automatically create the owner permission
  INSERT INTO public.workspaces (name, organization_id, created_by, updated_by)
  VALUES ('Personal', new_org_id, NEW.id, NEW.id)
  RETURNING id INTO new_workspace_id;

  -- Manual permission inserts removed - handled by triggers now
  -- This prevents duplicate ownership permissions

  RETURN NEW;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION public.handle_new_user() IS 'Auto-provisions personal organization and workspace for new users. Ownership permissions are automatically created by ownership triggers.';
