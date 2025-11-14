-- Seed org_member role for invited users
-- This role provides basic read access to the organization

DO $$
DECLARE
  system_user_id UUID := '08f06a03-3e42-4e55-8d35-b6fd04b6a69a';
  org_member_role_id UUID;
  existing_role_id UUID;
BEGIN

  -- Check if org_member role already exists
  SELECT id INTO existing_role_id
  FROM public.roles
  WHERE name = 'org_member'
  AND deleted_at IS NULL;

  IF existing_role_id IS NOT NULL THEN
    RAISE NOTICE 'org_member role already exists with id: %', existing_role_id;
    RETURN;
  END IF;

  -- Create org_member role
  INSERT INTO public.roles (id, name, description, created_by, updated_by)
  VALUES (
    gen_random_uuid(),
    'org_member',
    'Basic organization membership with read access',
    system_user_id,
    system_user_id
  )
  RETURNING id INTO org_member_role_id;

  RAISE NOTICE 'Created org_member role: %', org_member_role_id;

  -- Create permissions for org_member (organization-wide read access)
  INSERT INTO public.permissions (role_id, resource, action, apply_org_wide, apply_workspace_wide, created_by, updated_by)
  VALUES
    (org_member_role_id, 'organization', 'read', TRUE, FALSE, system_user_id, system_user_id);

  RAISE NOTICE 'Created 1 permission for org_member';

END $$;

-- Verify
DO $$
DECLARE
  role_count INTEGER;
  permission_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO role_count FROM public.roles WHERE name = 'org_member' AND deleted_at IS NULL;
  SELECT COUNT(*) INTO permission_count FROM public.permissions WHERE role_id IN (SELECT id FROM public.roles WHERE name = 'org_member' AND deleted_at IS NULL);

  RAISE NOTICE 'Verification: org_member roles = %, permissions = %', role_count, permission_count;
END $$;
