-- Update auto-provision trigger to include RBAC role assignments
-- This ensures new users get proper permissions for their Personal org/workspace

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_org_id UUID;
  new_workspace_id UUID;
  org_owner_role_id UUID;
  workspace_owner_role_id UUID;
BEGIN
  -- Get role IDs
  SELECT id INTO org_owner_role_id
  FROM public.roles
  WHERE name = 'org_owner'
  AND deleted_at IS NULL
  LIMIT 1;

  SELECT id INTO workspace_owner_role_id
  FROM public.roles
  WHERE name = 'workspace_owner'
  AND deleted_at IS NULL
  LIMIT 1;

  -- Insert personal organization
  INSERT INTO public.organizations (name, created_by, updated_by)
  VALUES ('Personal', NEW.id, NEW.id)
  RETURNING id INTO new_org_id;

  -- Insert personal workspace
  INSERT INTO public.workspaces (name, organization_id, created_by, updated_by)
  VALUES ('Personal', new_org_id, NEW.id, NEW.id)
  RETURNING id INTO new_workspace_id;

  -- Add user to organization_members
  INSERT INTO public.organization_members (org_id, user_id, created_by, updated_by)
  VALUES (new_org_id, NEW.id, NEW.id, NEW.id);

  -- Assign org_owner role if it exists
  IF org_owner_role_id IS NOT NULL THEN
    INSERT INTO public.principal_role_assignments
      (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
    VALUES
      ('user', NEW.id, new_org_id, NULL, org_owner_role_id, NEW.id, NEW.id);
  END IF;

  -- Assign workspace_owner role if it exists
  IF workspace_owner_role_id IS NOT NULL THEN
    INSERT INTO public.principal_role_assignments
      (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
    VALUES
      ('user', NEW.id, new_org_id, new_workspace_id, workspace_owner_role_id, NEW.id, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 'Auto-provisions personal organization, workspace, and RBAC roles for new users';
