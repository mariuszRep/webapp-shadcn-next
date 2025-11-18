-- Debug and fix permissions issue
-- This will show us what's in the tables and materialized views

-- First, let's check what's in organization_members_view
DO $$
BEGIN
  RAISE NOTICE 'Organization Members View Contents:';
END $$;
SELECT org_id, user_id, role_id, role_name FROM public.organization_members_view;

-- Check permissions table
DO $$
BEGIN
  RAISE NOTICE 'Permissions Table Contents:';
END $$;
SELECT
  p.id,
  p.org_id,
  p.principal_type,
  p.principal_id,
  p.object_type,
  p.object_id,
  r.name as role_name,
  p.deleted_at
FROM public.permissions p
LEFT JOIN public.roles r ON p.role_id = r.id
WHERE p.deleted_at IS NULL;

-- Check roles table
DO $$
BEGIN
  RAISE NOTICE 'Roles Table Contents:';
END $$;
SELECT id, name, org_id, deleted_at FROM public.roles WHERE deleted_at IS NULL;

-- Refresh the views again
REFRESH MATERIALIZED VIEW CONCURRENTLY public.organization_members_view;
REFRESH MATERIALIZED VIEW CONCURRENTLY public.workspace_members_view;
