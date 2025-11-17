-- Add error logging to has_permission function and handle_new_user trigger
-- This improves debuggability by logging permission failures and invitation processing

-- Update has_permission to add logging when membership check fails
CREATE OR REPLACE FUNCTION public.has_permission(
  _resource resource_kind,
  _action TEXT,
  _org_id UUID,
  _workspace_id UUID DEFAULT NULL,
  _entity_type_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  is_member BOOLEAN;
BEGIN
  -- Get current user
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE NOTICE 'has_permission: No authenticated user';
    RETURN FALSE;
  END IF;

  -- First, validate that the user is a member of the organization
  -- This ensures we don't grant permissions without organization membership
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE org_id = _org_id
      AND user_id = current_user_id
      AND deleted_at IS NULL
  ) INTO is_member;

  IF NOT is_member THEN
    RAISE NOTICE 'has_permission: User % is not a member of organization %', current_user_id, _org_id;
    RETURN FALSE;
  END IF;

  -- Check if user has permission through their roles or team roles
  RETURN EXISTS (
    WITH principals AS (
      -- User as principal
      SELECT 'user'::principal_kind AS kind, current_user_id AS id
      UNION
      -- Teams the user belongs to as principals
      SELECT 'team'::principal_kind AS kind, tm.team_id AS id
      FROM public.team_members tm
      WHERE tm.user_id = current_user_id
        AND tm.deleted_at IS NULL
    ),
    user_roles AS (
      -- Get all role assignments for the user's principals
      SELECT DISTINCT pra.role_id
      FROM public.principal_role_assignments pra
      INNER JOIN principals p ON p.kind = pra.principal_kind AND p.id = pra.principal_id
      WHERE pra.org_id = _org_id
        AND pra.deleted_at IS NULL
        AND (
          -- Org-level roles (workspace_id IS NULL) apply to all workspaces
          pra.workspace_id IS NULL
          -- Or workspace-specific roles match the requested workspace
          OR (_workspace_id IS NOT NULL AND pra.workspace_id = _workspace_id)
        )
    )
    SELECT 1
    FROM public.permissions perms
    INNER JOIN user_roles ur ON ur.role_id = perms.role_id
    WHERE perms.resource = _resource
      AND perms.action = _action
      AND perms.deleted_at IS NULL
      AND (
        -- Org-wide permissions apply everywhere in the org
        perms.apply_org_wide = TRUE
        -- Or workspace-wide permissions apply to all entities in the workspace
        OR (_workspace_id IS NOT NULL AND perms.apply_workspace_wide = TRUE)
        -- Or entity-type-specific permissions match the requested type
        OR (
          _entity_type_id IS NOT NULL
          AND perms.entity_type_id = _entity_type_id
        )
        -- Or no specific scoping required
        OR (
          perms.apply_org_wide = FALSE
          AND perms.apply_workspace_wide = FALSE
          AND perms.entity_type_id IS NULL
        )
      )
  );
END;
$$;

COMMENT ON FUNCTION public.has_permission(resource_kind, TEXT, UUID, UUID, UUID) IS
  'Checks if current user has permission for an action on a resource. Validates organization membership first, then checks role-based permissions. Logs failures for debugging.';

-- Update handle_new_user to add comprehensive logging
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
  RAISE NOTICE 'handle_new_user: Processing new user %', NEW.email;

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
    RAISE NOTICE 'handle_new_user: Found invitation % for user % to org %', invitation_id, NEW.email, invited_org_id;

    -- INVITED USER: Create workspace in invited org
    workspace_name := COALESCE(split_part(NEW.email, '@', 1), 'User') || '''s Workspace';

    INSERT INTO public.workspaces (name, organization_id, created_by, updated_by)
    VALUES (workspace_name, invited_org_id, NEW.id, NEW.id)
    RETURNING id INTO new_workspace_id;

    RAISE NOTICE 'handle_new_user: Created workspace % for user % in org %', new_workspace_id, NEW.email, invited_org_id;

    INSERT INTO public.organization_members (org_id, user_id, created_by, updated_by)
    VALUES (invited_org_id, NEW.id, NEW.id, NEW.id);

    RAISE NOTICE 'handle_new_user: Added user % as member of org %', NEW.email, invited_org_id;

    IF org_member_role_id IS NOT NULL THEN
      INSERT INTO public.principal_role_assignments
        (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
      VALUES ('user', NEW.id, invited_org_id, NULL, org_member_role_id, NEW.id, NEW.id);
      RAISE NOTICE 'handle_new_user: Assigned org_member role to user % in org %', NEW.email, invited_org_id;
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

COMMENT ON FUNCTION public.handle_new_user() IS 'Auto-provisions users with comprehensive logging: invited users get workspace in invited org, self-signup users get Personal org.';
