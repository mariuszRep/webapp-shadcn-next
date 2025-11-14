-- Update trigger to check invitations table instead of user metadata
-- This is more reliable than relying on metadata persistence

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
  -- Check if user was invited to an organization
  SELECT inv.org_id, inv.id INTO invited_org_id, invitation_id
  FROM public.invitations inv
  WHERE inv.email = NEW.email
    AND inv.deleted_at IS NULL
    AND inv.accepted_at IS NULL
  ORDER BY inv.created_at DESC
  LIMIT 1;

  -- Get role IDs
  SELECT id INTO org_owner_role_id
  FROM public.roles
  WHERE name = 'org_owner'
  AND deleted_at IS NULL
  LIMIT 1;

  SELECT id INTO org_member_role_id
  FROM public.roles
  WHERE name = 'org_member'
  AND deleted_at IS NULL
  LIMIT 1;

  SELECT id INTO workspace_owner_role_id
  FROM public.roles
  WHERE name = 'workspace_owner'
  AND deleted_at IS NULL
  LIMIT 1;

  -- Branch: Invited user vs Self-signup user
  IF invited_org_id IS NOT NULL THEN
    -- INVITED USER: Create workspace in invited organization
    BEGIN
      -- Mark invitation as accepted
      UPDATE public.invitations
      SET accepted_at = now(), updated_at = now()
      WHERE id = invitation_id;

      -- Generate workspace name from email
      workspace_name := COALESCE(
        split_part(NEW.email, '@', 1),
        'User'
      ) || '''s Workspace';

      -- Create personal workspace in the invited organization
      INSERT INTO public.workspaces (name, organization_id, created_by, updated_by)
      VALUES (workspace_name, invited_org_id, NEW.id, NEW.id)
      RETURNING id INTO new_workspace_id;

      -- Add to organization_members
      INSERT INTO public.organization_members (org_id, user_id, created_by, updated_by)
      VALUES (invited_org_id, NEW.id, NEW.id, NEW.id)
      ON CONFLICT (org_id, user_id) DO NOTHING;

      -- Assign org_member role if it exists
      IF org_member_role_id IS NOT NULL THEN
        INSERT INTO public.principal_role_assignments
          (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
        VALUES
          ('user', NEW.id, invited_org_id, NULL, org_member_role_id, NEW.id, NEW.id)
        ON CONFLICT (principal_kind, principal_id, org_id, workspace_id, role_id) DO NOTHING;
      END IF;

      -- Assign workspace_owner role for their workspace if it exists
      IF workspace_owner_role_id IS NOT NULL AND new_workspace_id IS NOT NULL THEN
        INSERT INTO public.principal_role_assignments
          (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
        VALUES
          ('user', NEW.id, invited_org_id, new_workspace_id, workspace_owner_role_id, NEW.id, NEW.id)
        ON CONFLICT (principal_kind, principal_id, org_id, workspace_id, role_id) DO NOTHING;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail user creation
      RAISE WARNING 'Failed to provision invited user workspace: %', SQLERRM;
      -- Fall back to creating Personal org/workspace
      invited_org_id := NULL;
    END;
  END IF;

  -- Self-signup user OR invited user provisioning failed
  IF invited_org_id IS NULL THEN
    -- SELF-SIGNUP USER: Create Personal organization + workspace
    BEGIN
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

    EXCEPTION WHEN OTHERS THEN
      -- This is critical - log and re-raise
      RAISE EXCEPTION 'Failed to provision Personal org/workspace: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Smart auto-provision using invitations table: Creates workspace in invited org for invited users, or Personal org+workspace for self-signup users. More reliable than metadata-based detection.';
