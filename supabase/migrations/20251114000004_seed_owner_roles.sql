-- Seed minimal roles and permissions for organization and workspace owners
-- This migration creates the essential roles needed for user access

-- System user UUID for created_by/updated_by
-- Using the current user as system user for seeding
DO $$
DECLARE
  system_user_id UUID := '08f06a03-3e42-4e55-8d35-b6fd04b6a69a';
  org_owner_role_id UUID;
  workspace_owner_role_id UUID;
  org_personal_id UUID := 'babbe51c-dbbd-43c0-a002-19ca63815839';
  org_test_id UUID := 'd48232b9-c397-4cf8-b7f9-2f67baf1415f';
  ws_personal_id UUID := '8575d15b-d565-46c5-a9f4-1ab6b9f4f60b';
  ws_openai_id UUID := 'e6366054-dd20-4e2e-8880-1fdc3e763c28';
  ws_new_id UUID := 'bd6f88bd-53eb-4127-8d88-9b979578097f';
BEGIN

  -- ============================================================================
  -- STEP 1: Create Roles
  -- ============================================================================

  -- Create org_owner role
  INSERT INTO public.roles (id, name, description, created_by, updated_by)
  VALUES (
    gen_random_uuid(),
    'org_owner',
    'Full control over organization and all workspaces',
    system_user_id,
    system_user_id
  )
  RETURNING id INTO org_owner_role_id;

  RAISE NOTICE 'Created org_owner role: %', org_owner_role_id;

  -- Create workspace_owner role
  INSERT INTO public.roles (id, name, description, created_by, updated_by)
  VALUES (
    gen_random_uuid(),
    'workspace_owner',
    'Full control over specific workspace',
    system_user_id,
    system_user_id
  )
  RETURNING id INTO workspace_owner_role_id;

  RAISE NOTICE 'Created workspace_owner role: %', workspace_owner_role_id;

  -- ============================================================================
  -- STEP 2: Create Permissions for org_owner (org-wide)
  -- ============================================================================

  -- Organization permissions (org-wide)
  INSERT INTO public.permissions (role_id, resource, action, apply_org_wide, apply_workspace_wide, created_by, updated_by)
  VALUES
    (org_owner_role_id, 'organization', 'read', TRUE, FALSE, system_user_id, system_user_id),
    (org_owner_role_id, 'organization', 'update', TRUE, FALSE, system_user_id, system_user_id),
    (org_owner_role_id, 'organization', 'delete', TRUE, FALSE, system_user_id, system_user_id),
    (org_owner_role_id, 'organization', 'manage_members', TRUE, FALSE, system_user_id, system_user_id),
    (org_owner_role_id, 'organization', 'manage_teams', TRUE, FALSE, system_user_id, system_user_id),
    (org_owner_role_id, 'organization', 'manage_roles', TRUE, FALSE, system_user_id, system_user_id);

  -- Workspace permissions (org-wide - can manage all workspaces in org)
  INSERT INTO public.permissions (role_id, resource, action, apply_org_wide, apply_workspace_wide, created_by, updated_by)
  VALUES
    (org_owner_role_id, 'workspace', 'read', TRUE, FALSE, system_user_id, system_user_id),
    (org_owner_role_id, 'workspace', 'create', TRUE, FALSE, system_user_id, system_user_id),
    (org_owner_role_id, 'workspace', 'update', TRUE, FALSE, system_user_id, system_user_id),
    (org_owner_role_id, 'workspace', 'delete', TRUE, FALSE, system_user_id, system_user_id);

  RAISE NOTICE 'Created % permissions for org_owner', 10;

  -- ============================================================================
  -- STEP 3: Create Permissions for workspace_owner (workspace-wide)
  -- ============================================================================

  -- Workspace permissions (workspace-wide)
  INSERT INTO public.permissions (role_id, resource, action, apply_org_wide, apply_workspace_wide, created_by, updated_by)
  VALUES
    (workspace_owner_role_id, 'workspace', 'read', FALSE, TRUE, system_user_id, system_user_id),
    (workspace_owner_role_id, 'workspace', 'update', FALSE, TRUE, system_user_id, system_user_id),
    (workspace_owner_role_id, 'workspace', 'delete', FALSE, TRUE, system_user_id, system_user_id);

  RAISE NOTICE 'Created % permissions for workspace_owner', 3;

  -- ============================================================================
  -- STEP 4: Add user to organization_members
  -- ============================================================================

  -- Add to Personal organization
  INSERT INTO public.organization_members (org_id, user_id, created_by, updated_by)
  VALUES (org_personal_id, system_user_id, system_user_id, system_user_id)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  -- Add to Test organization
  INSERT INTO public.organization_members (org_id, user_id, created_by, updated_by)
  VALUES (org_test_id, system_user_id, system_user_id, system_user_id)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  RAISE NOTICE 'Added user to organization_members for 2 organizations';

  -- ============================================================================
  -- STEP 5: Assign org_owner role to user for both organizations
  -- ============================================================================

  -- Assign org_owner for Personal organization
  INSERT INTO public.principal_role_assignments
    (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
  VALUES
    ('user', system_user_id, org_personal_id, NULL, org_owner_role_id, system_user_id, system_user_id);

  -- Assign org_owner for Test organization
  INSERT INTO public.principal_role_assignments
    (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
  VALUES
    ('user', system_user_id, org_test_id, NULL, org_owner_role_id, system_user_id, system_user_id);

  RAISE NOTICE 'Assigned org_owner role to user for 2 organizations';

  -- ============================================================================
  -- STEP 6: Assign workspace_owner role to user for all workspaces
  -- ============================================================================

  -- Assign workspace_owner for Personal workspace (in Personal org)
  INSERT INTO public.principal_role_assignments
    (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
  VALUES
    ('user', system_user_id, org_personal_id, ws_personal_id, workspace_owner_role_id, system_user_id, system_user_id);

  -- Assign workspace_owner for OpenAI workspace (in Personal org)
  INSERT INTO public.principal_role_assignments
    (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
  VALUES
    ('user', system_user_id, org_personal_id, ws_openai_id, workspace_owner_role_id, system_user_id, system_user_id);

  -- Assign workspace_owner for New workspace (in Test org)
  INSERT INTO public.principal_role_assignments
    (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
  VALUES
    ('user', system_user_id, org_test_id, ws_new_id, workspace_owner_role_id, system_user_id, system_user_id);

  RAISE NOTICE 'Assigned workspace_owner role to user for 3 workspaces';

  RAISE NOTICE '=== Migration Complete ===';
  RAISE NOTICE 'Created 2 roles';
  RAISE NOTICE 'Created 13 permissions';
  RAISE NOTICE 'Assigned user to 2 organizations';
  RAISE NOTICE 'Assigned user to 2 org_owner roles';
  RAISE NOTICE 'Assigned user to 3 workspace_owner roles';

END $$;

-- Verify the setup
DO $$
DECLARE
  role_count INTEGER;
  permission_count INTEGER;
  org_member_count INTEGER;
  role_assignment_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO role_count FROM public.roles WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO permission_count FROM public.permissions WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO org_member_count FROM public.organization_members WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO role_assignment_count FROM public.principal_role_assignments WHERE deleted_at IS NULL;

  RAISE NOTICE '=== Verification ===';
  RAISE NOTICE 'Total roles: %', role_count;
  RAISE NOTICE 'Total permissions: %', permission_count;
  RAISE NOTICE 'Total organization members: %', org_member_count;
  RAISE NOTICE 'Total role assignments: %', role_assignment_count;
END $$;
