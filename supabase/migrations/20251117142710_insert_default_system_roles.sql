-- =====================================================
-- INSERT DEFAULT SYSTEM ROLES
-- =====================================================
-- Insert default system-wide roles (org_id = NULL)
-- These will be used for auto-provisioning and can be referenced across all organizations
-- Using SQL-aligned action terminology: SELECT, INSERT, UPDATE, DELETE

-- Owner role - full control
INSERT INTO public.roles (name, description, permissions, org_id, created_by, updated_by)
SELECT
    'owner',
    'Organization owner with full administrative access',
    '["select", "insert", "update", "delete"]'::jsonb,
    NULL,
    NULL,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles WHERE name = 'owner' AND org_id IS NULL
);

-- Admin role - administrative access
INSERT INTO public.roles (name, description, permissions, org_id, created_by, updated_by)
SELECT
    'admin',
    'Administrator with full access except billing and owner transfer',
    '["select", "insert", "update", "delete"]'::jsonb,
    NULL,
    NULL,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles WHERE name = 'admin' AND org_id IS NULL
);

-- Member role - standard access
INSERT INTO public.roles (name, description, permissions, org_id, created_by, updated_by)
SELECT
    'member',
    'Standard member with read and write access',
    '["select", "insert"]'::jsonb,
    NULL,
    NULL,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles WHERE name = 'member' AND org_id IS NULL
);

-- Viewer role - read-only access
INSERT INTO public.roles (name, description, permissions, org_id, created_by, updated_by)
SELECT
    'viewer',
    'Read-only access to organization resources',
    '["select"]'::jsonb,
    NULL,
    NULL,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles WHERE name = 'viewer' AND org_id IS NULL
);

-- =====================================================
-- UPDATE AUTO-PROVISION TRIGGER
-- =====================================================
-- Update the handle_new_user function to also create permissions for the new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  new_org_id UUID;
  new_workspace_id UUID;
  owner_role_id UUID;
BEGIN
  -- Get the owner role ID
  SELECT id INTO owner_role_id
  FROM public.roles
  WHERE name = 'owner' AND org_id IS NULL
  LIMIT 1;

  -- Insert personal organization
  INSERT INTO public.organizations (name, created_by, updated_by)
  VALUES ('Personal', NEW.id, NEW.id)
  RETURNING id INTO new_org_id;

  -- Insert personal workspace
  INSERT INTO public.workspaces (name, organization_id, created_by, updated_by)
  VALUES ('Personal', new_org_id, NEW.id, NEW.id)
  RETURNING id INTO new_workspace_id;

  -- Grant owner permission on the organization
  INSERT INTO public.permissions (
    org_id,
    principal_type,
    principal_id,
    role_id,
    object_type,
    object_id,
    created_by,
    updated_by
  )
  VALUES (
    new_org_id,
    'user',
    NEW.id,
    owner_role_id,
    'organization',
    new_org_id,
    NEW.id,
    NEW.id
  );

  -- Grant owner permission on the workspace
  INSERT INTO public.permissions (
    org_id,
    principal_type,
    principal_id,
    role_id,
    object_type,
    object_id,
    created_by,
    updated_by
  )
  VALUES (
    new_org_id,
    'user',
    NEW.id,
    owner_role_id,
    'workspace',
    new_workspace_id,
    NEW.id,
    NEW.id
  );

  RETURN NEW;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION public.handle_new_user() IS 'Auto-provisions personal organization, workspace, and owner permissions for new users';
