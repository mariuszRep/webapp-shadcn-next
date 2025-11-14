-- Function to process pending invitations when user logs in
-- This handles cases where user already exists but has pending invitations

CREATE OR REPLACE FUNCTION public.process_pending_invitations()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  invitation_record RECORD;
  new_workspace_id UUID;
  workspace_name TEXT;
  org_member_role_id UUID;
  workspace_owner_role_id UUID;
BEGIN
  -- Get role IDs
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

  -- Process all pending invitations for this user
  FOR invitation_record IN
    SELECT id, org_id, email
    FROM public.invitations
    WHERE email = NEW.email
      AND deleted_at IS NULL
      AND accepted_at IS NULL
    ORDER BY created_at DESC
  LOOP
    -- Check if user is already a member of this organization
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE org_id = invitation_record.org_id
        AND user_id = NEW.id
        AND deleted_at IS NULL
    ) THEN
      -- Add to organization_members
      INSERT INTO public.organization_members (org_id, user_id, created_by, updated_by)
      VALUES (invitation_record.org_id, NEW.id, NEW.id, NEW.id)
      ON CONFLICT (org_id, user_id) DO NOTHING;

      -- Check if user already has a workspace in this org
      IF NOT EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE organization_id = invitation_record.org_id
          AND created_by = NEW.id
          AND deleted_at IS NULL
      ) THEN
        -- Create workspace for user in this organization
        workspace_name := COALESCE(
          split_part(NEW.email, '@', 1),
          'User'
        ) || '''s Workspace';

        INSERT INTO public.workspaces (name, organization_id, created_by, updated_by)
        VALUES (workspace_name, invitation_record.org_id, NEW.id, NEW.id)
        RETURNING id INTO new_workspace_id;

        -- Assign workspace_owner role
        IF workspace_owner_role_id IS NOT NULL AND new_workspace_id IS NOT NULL THEN
          INSERT INTO public.principal_role_assignments
            (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
          VALUES
            ('user', NEW.id, invitation_record.org_id, new_workspace_id, workspace_owner_role_id, NEW.id, NEW.id)
          ON CONFLICT (principal_kind, principal_id, org_id, workspace_id, role_id) DO NOTHING;
        END IF;
      END IF;

      -- Assign org_member role
      IF org_member_role_id IS NOT NULL THEN
        INSERT INTO public.principal_role_assignments
          (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
        VALUES
          ('user', NEW.id, invitation_record.org_id, NULL, org_member_role_id, NEW.id, NEW.id)
        ON CONFLICT (principal_kind, principal_id, org_id, workspace_id, role_id) DO NOTHING;
      END IF;

      -- Mark invitation as accepted
      UPDATE public.invitations
      SET accepted_at = now(), updated_at = now()
      WHERE id = invitation_record.id;

      RAISE NOTICE 'Processed invitation for user % to org %', NEW.email, invitation_record.org_id;
    ELSE
      -- User already in org, just mark invitation as accepted
      UPDATE public.invitations
      SET accepted_at = now(), updated_at = now()
      WHERE id = invitation_record.id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger on user login (when last_sign_in_at is updated)
-- This fires whenever a user signs in
DROP TRIGGER IF EXISTS on_user_login ON auth.users;

CREATE TRIGGER on_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.process_pending_invitations();

COMMENT ON FUNCTION public.process_pending_invitations() IS 'Processes pending organization invitations when user logs in. Adds user to invited organizations and creates their workspace.';
