-- Temporarily simplify trigger to bare minimum to debug what's failing
-- Just create Personal org/workspace, no invitation logic

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_org_id UUID;
  new_workspace_id UUID;
BEGIN
  RAISE NOTICE 'Starting handle_new_user for: %', NEW.email;

  -- Insert personal organization
  INSERT INTO public.organizations (name, created_by, updated_by)
  VALUES ('Personal', NEW.id, NEW.id)
  RETURNING id INTO new_org_id;

  RAISE NOTICE 'Created org: %', new_org_id;

  -- Insert personal workspace
  INSERT INTO public.workspaces (name, organization_id, created_by, updated_by)
  VALUES ('Personal', new_org_id, NEW.id, NEW.id)
  RETURNING id INTO new_workspace_id;

  RAISE NOTICE 'Created workspace: %', new_workspace_id;

  -- Add user to organization_members
  INSERT INTO public.organization_members (org_id, user_id, created_by, updated_by)
  VALUES (new_org_id, NEW.id, NEW.id, NEW.id);

  RAISE NOTICE 'Added to org members';

  RAISE NOTICE 'Completed handle_new_user for: %', NEW.email;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: % (SQLSTATE: %)', NEW.email, SQLERRM, SQLSTATE;
  RAISE EXCEPTION 'Failed to provision user: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'DEBUGGING VERSION - Simplified trigger without invitation logic';
