-- =====================================================
-- CONVERT MATERIALIZED VIEW TO REGULAR VIEW
-- =====================================================
-- This fixes the blocking issue where REFRESH MATERIALIZED VIEW fails
-- when the view is being queried in the same session
-- Regular views are always up-to-date and don't need refreshing

-- Drop the refresh triggers first
DROP TRIGGER IF EXISTS trg_refresh_users_permissions ON public.permissions;
DROP TRIGGER IF EXISTS trg_refresh_users_permissions_on_role_change ON public.roles;
DROP FUNCTION IF EXISTS public.refresh_users_permissions_view();

-- Drop the materialized view
DROP MATERIALIZED VIEW IF EXISTS public.users_permissions;

-- Create as a regular VIEW instead
CREATE OR REPLACE VIEW public.users_permissions AS
SELECT DISTINCT
    p.org_id,
    p.object_type,
    p.object_id,
    p.principal_id AS user_id,
    p.role_id,
    r.name AS role_name,
    r.permissions AS role_permissions
FROM public.permissions p
JOIN public.roles r ON p.role_id = r.id
WHERE p.principal_type = 'user'
  AND p.deleted_at IS NULL
  AND r.deleted_at IS NULL
  AND p.object_id IS NOT NULL;

-- Add indexes on the underlying permissions table for performance
-- These ensure the view queries are fast
CREATE INDEX IF NOT EXISTS idx_permissions_principal_user
ON public.permissions(principal_id, principal_type)
WHERE principal_type = 'user' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_permissions_object_lookup
ON public.permissions(object_type, object_id, deleted_at)
WHERE deleted_at IS NULL;

-- Update comment
COMMENT ON VIEW public.users_permissions IS 'Real-time view of all user permissions across organizations and workspaces. Always up-to-date without requiring manual refresh.';
