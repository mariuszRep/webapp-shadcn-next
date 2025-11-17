-- =====================================================
-- STANDARDIZE PERMISSION TERMINOLOGY
-- =====================================================
-- This migration standardizes the permission system to align with SQL terminology:
-- - principal_type: 'user' | 'team' (removed 'api_key')
-- - object_type: 'organization' | 'workspace' (removed 'project', 'task')
-- - action: 'select' | 'insert' | 'update' | 'delete' (aligns with SQL: SELECT, INSERT, UPDATE, DELETE)

-- =====================================================
-- UPDATE CHECK CONSTRAINTS ON PERMISSIONS TABLE
-- =====================================================

-- Drop old constraints
ALTER TABLE public.permissions
  DROP CONSTRAINT IF EXISTS chk_principal_type,
  DROP CONSTRAINT IF EXISTS chk_object_type;

-- Add updated constraints with standardized values
ALTER TABLE public.permissions
  ADD CONSTRAINT chk_principal_type CHECK (principal_type IN ('user', 'team')),
  ADD CONSTRAINT chk_object_type CHECK (object_type IN ('organization', 'workspace'));

-- =====================================================
-- UPDATE DEFAULT ROLES: ALIGN WITH SQL TERMINOLOGY
-- =====================================================

-- Update owner role (full permissions)
UPDATE public.roles
SET permissions = '["select", "insert", "update", "delete"]'::jsonb
WHERE name = 'owner' AND org_id IS NULL
  AND permissions = '["read", "create", "update", "delete"]'::jsonb;

-- Update admin role (full permissions)
UPDATE public.roles
SET permissions = '["select", "insert", "update", "delete"]'::jsonb
WHERE name = 'admin' AND org_id IS NULL
  AND permissions = '["read", "create", "update", "delete"]'::jsonb;

-- Update member role (read and write)
UPDATE public.roles
SET permissions = '["select", "insert"]'::jsonb
WHERE name = 'member' AND org_id IS NULL
  AND permissions = '["read", "create"]'::jsonb;

-- Update viewer role (read-only)
UPDATE public.roles
SET permissions = '["select"]'::jsonb
WHERE name = 'viewer' AND org_id IS NULL
  AND permissions = '["read"]'::jsonb;

-- =====================================================
-- UPDATE COMMENTS WITH SQL-ALIGNED TERMINOLOGY
-- =====================================================

-- Update permissions table comments
COMMENT ON COLUMN public.permissions.principal_type IS 'Type of principal: ''user'' (auth.users.id) or ''team'' (teams.id for future use)';
COMMENT ON COLUMN public.permissions.object_type IS 'Type of object: ''organization'' or ''workspace''';

-- Update roles table comments
COMMENT ON COLUMN public.roles.permissions IS 'JSONB array of SQL-aligned actions: ["select", "insert", "update", "delete"]';

-- Update table-level comments
COMMENT ON TABLE public.permissions IS 'Role-based object permission model. Assigns roles to principals (users, teams) for specific objects (organizations, workspaces). Uses SQL-aligned action terminology.';
COMMENT ON MATERIALIZED VIEW public.organization_members_view IS 'Materialized view of users/teams with permissions on organizations. Automatically refreshed when permissions change.';
COMMENT ON MATERIALIZED VIEW public.workspace_members_view IS 'Materialized view of users/teams with permissions on workspaces. Automatically refreshed when permissions change.';
