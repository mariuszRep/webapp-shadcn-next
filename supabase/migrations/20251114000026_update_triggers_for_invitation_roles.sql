-- Update triggers to read role_id from invitations table
-- This allows invitations to specify custom roles instead of defaulting to org_member

-- Update handle_new_user to use role_id from invitation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  invited_org_id UUID;
  invitation_id UUID;
  invitation_role_id UUID;
  new_org_id UUID;
  new_workspace_id UUID;
  org_owner_role_id UUID;
  org_member_role_id UUID;
  workspace_owner_role_id UUID;
  workspace_name TEXT;
  assigned_role_id UUID;
BEGIN
  RAISE NOTICE 'handle_new_user: Processing new user %', NEW.email;

  -- Get role IDs once at the start
  SELECT id INTO org_owner_role_id FROM public.roles WHERE name = 'org_owner' AND deleted_at IS NULL;
  SELECT id INTO org_member_role_id FROM public.roles WHERE name = 'org_member' AND deleted_at IS NULL;
  SELECT id INTO workspace_owner_role_id FROM public.roles WHERE name = 'workspace_owner' AND deleted_at IS NULL;

  -- Check for pending invitation and get role_id if specified
  SELECT inv.org_id, inv.id, inv.role_id
  INTO invited_org_id, invitation_id, invitation_role_id
  FROM public.invitations inv
  WHERE inv.email = NEW.email
    AND inv.deleted_at IS NULL
    AND inv.accepted_at IS NULL
    AND (inv.expiry_at IS NULL OR inv.expiry_at > now())
  ORDER BY inv.created_at DESC
  LIMIT 1;

  IF invited_org_id IS NOT NULL THEN
    RAISE NOTICE 'handle_new_user: Found invitation % for user % to org % with role_id %',
      invitation_id, NEW.email, invited_org_id, invitation_role_id;

    -- INVITED USER: Create workspace in invited org
    workspace_name := COALESCE(split_part(NEW.email, '@', 1), 'User') || '''s Workspace';

    INSERT INTO public.workspaces (name, organization_id, created_by, updated_by)
    VALUES (workspace_name, invited_org_id, NEW.id, NEW.id)
    RETURNING id INTO new_workspace_id;

    RAISE NOTICE 'handle_new_user: Created workspace % for user % in org %', new_workspace_id, NEW.email, invited_org_id;

    INSERT INTO public.organization_members (org_id, user_id, created_by, updated_by)
    VALUES (invited_org_id, NEW.id, NEW.id, NEW.id);

    RAISE NOTICE 'handle_new_user: Added user % as member of org %', NEW.email, invited_org_id;

    -- Use invitation role_id if specified, otherwise default to org_member
    assigned_role_id := COALESCE(invitation_role_id, org_member_role_id);

    IF assigned_role_id IS NOT NULL THEN
      INSERT INTO public.principal_role_assignments
        (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
      VALUES ('user', NEW.id, invited_org_id, NULL, assigned_role_id, NEW.id, NEW.id);
      RAISE NOTICE 'handle_new_user: Assigned role % to user % in org %', assigned_role_id, NEW.email, invited_org_id;
    END IF;

    IF workspace_owner_role_id IS NOT NULL THEN
      INSERT INTO public.principal_role_assignments
        (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
      VALUES ('user', NEW.id, invited_org_id, new_workspace_id, workspace_owner_role_id, NEW.id, NEW.id);
      RAISE NOTICE 'handle_new_user: Assigned workspace_owner role to user % in workspace %', NEW.email, new_workspace_id;
    END IF;

    UPDATE public.invitations SET accepted_at = now() WHERE id = invitation_id;
    RAISE NOTICE 'handle_new_user: Marked invitation % as accepted', invitation_id;

  ELSE
    RAISE NOTICE 'handle_new_user: No invitation found, creating Personal org for user %', NEW.email;

    -- SELF-SIGNUP USER: Create Personal org
    INSERT INTO public.organizations (name, created_by, updated_by)
    VALUES ('Personal', NEW.id, NEW.id)
    RETURNING id INTO new_org_id;

    RAISE NOTICE 'handle_new_user: Created Personal org % for user %', new_org_id, NEW.email;

    INSERT INTO public.workspaces (name, organization_id, created_by, updated_by)
    VALUES ('Personal', new_org_id, NEW.id, NEW.id)
    RETURNING id INTO new_workspace_id;

    RAISE NOTICE 'handle_new_user: Created Personal workspace % for user %', new_workspace_id, NEW.email;

    INSERT INTO public.organization_members (org_id, user_id, created_by, updated_by)
    VALUES (new_org_id, NEW.id, NEW.id, NEW.id);

    RAISE NOTICE 'handle_new_user: Added user % as member of Personal org %', NEW.email, new_org_id;

    IF org_owner_role_id IS NOT NULL THEN
      INSERT INTO public.principal_role_assignments
        (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
      VALUES ('user', NEW.id, new_org_id, NULL, org_owner_role_id, NEW.id, NEW.id);
      RAISE NOTICE 'handle_new_user: Assigned org_owner role to user % in org %', NEW.email, new_org_id;
    END IF;

    IF workspace_owner_role_id IS NOT NULL THEN
      INSERT INTO public.principal_role_assignments
        (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
      VALUES ('user', NEW.id, new_org_id, new_workspace_id, workspace_owner_role_id, NEW.id, NEW.id);
      RAISE NOTICE 'handle_new_user: Assigned workspace_owner role to user % in workspace %', NEW.email, new_workspace_id;
    END IF;
  END IF;

  RAISE NOTICE 'handle_new_user: Successfully processed user %', NEW.email;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: Error processing user %: % %', NEW.email, SQLERRM, SQLSTATE;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Auto-provisions users with role from invitation: invited users get role from invitation (defaults to org_member), self-signup users get Personal org with org_owner role.';

-- Update process_pending_invitations to use role_id from invitation
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
  assigned_role_id UUID;
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
    SELECT id, org_id, email, role_id
    FROM public.invitations
    WHERE email = NEW.email
      AND deleted_at IS NULL
      AND accepted_at IS NULL
      AND (expiry_at IS NULL OR expiry_at > now())
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

      -- Use invitation role_id if specified, otherwise default to org_member
      assigned_role_id := COALESCE(invitation_record.role_id, org_member_role_id);

      -- Assign org role
      IF assigned_role_id IS NOT NULL THEN
        INSERT INTO public.principal_role_assignments
          (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
        VALUES
          ('user', NEW.id, invitation_record.org_id, NULL, assigned_role_id, NEW.id, NEW.id)
        ON CONFLICT (principal_kind, principal_id, org_id, workspace_id, role_id) DO NOTHING;

        RAISE NOTICE 'Assigned role % to user % in org %', assigned_role_id, NEW.email, invitation_record.org_id;
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

COMMENT ON FUNCTION public.process_pending_invitations() IS 'Processes pending organization invitations when user logs in. Adds user to invited organizations with role from invitation (defaults to org_member) and creates their workspace.';
