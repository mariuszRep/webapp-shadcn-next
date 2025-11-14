-- Fix and re-enable the trigger to auto-provision invited users

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  invited_org_id UUID;
  invitation_id UUID;
  new_org_id UUID;
  new_workspace_id UUID;
  org_owner_role_id UUID;
  org_member_role_id UUID;
  workspace_owner_role_id UUID;
  workspace_name TEXT;
BEGIN
  -- Get role IDs once at the start
  SELECT id INTO org_owner_role_id FROM public.roles WHERE name = 'org_owner' AND deleted_at IS NULL;
  SELECT id INTO org_member_role_id FROM public.roles WHERE name = 'org_member' AND deleted_at IS NULL;
  SELECT id INTO workspace_owner_role_id FROM public.roles WHERE name = 'workspace_owner' AND deleted_at IS NULL;

  -- Check for pending invitation
  SELECT inv.org_id, inv.id INTO invited_org_id, invitation_id
  FROM public.invitations inv
  WHERE inv.email = NEW.email
    AND inv.deleted_at IS NULL
    AND inv.accepted_at IS NULL
  ORDER BY inv.created_at DESC
  LIMIT 1;

  IF invited_org_id IS NOT NULL THEN
    -- INVITED USER: Create workspace in invited org
    workspace_name := COALESCE(split_part(NEW.email, '@', 1), 'User') || '''s Workspace';

    INSERT INTO public.workspaces (name, organization_id, created_by, updated_by)
    VALUES (workspace_name, invited_org_id, NEW.id, NEW.id)
    RETURNING id INTO new_workspace_id;

    INSERT INTO public.organization_members (org_id, user_id, created_by, updated_by)
    VALUES (invited_org_id, NEW.id, NEW.id, NEW.id);

    IF org_member_role_id IS NOT NULL THEN
      INSERT INTO public.principal_role_assignments
        (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
      VALUES ('user', NEW.id, invited_org_id, NULL, org_member_role_id, NEW.id, NEW.id);
    END IF;

    IF workspace_owner_role_id IS NOT NULL THEN
      INSERT INTO public.principal_role_assignments
        (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
      VALUES ('user', NEW.id, invited_org_id, new_workspace_id, workspace_owner_role_id, NEW.id, NEW.id);
    END IF;

    UPDATE public.invitations SET accepted_at = now() WHERE id = invitation_id;

  ELSE
    -- SELF-SIGNUP USER: Create Personal org
    INSERT INTO public.organizations (name, created_by, updated_by)
    VALUES ('Personal', NEW.id, NEW.id)
    RETURNING id INTO new_org_id;

    INSERT INTO public.workspaces (name, organization_id, created_by, updated_by)
    VALUES ('Personal', new_org_id, NEW.id, NEW.id)
    RETURNING id INTO new_workspace_id;

    INSERT INTO public.organization_members (org_id, user_id, created_by, updated_by)
    VALUES (new_org_id, NEW.id, NEW.id, NEW.id);

    IF org_owner_role_id IS NOT NULL THEN
      INSERT INTO public.principal_role_assignments
        (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
      VALUES ('user', NEW.id, new_org_id, NULL, org_owner_role_id, NEW.id, NEW.id);
    END IF;

    IF workspace_owner_role_id IS NOT NULL THEN
      INSERT INTO public.principal_role_assignments
        (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
      VALUES ('user', NEW.id, new_org_id, new_workspace_id, workspace_owner_role_id, NEW.id, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-enable trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 'Auto-provisions users: invited users get workspace in invited org, self-signup users get Personal org. FIXED and ENABLED.';
