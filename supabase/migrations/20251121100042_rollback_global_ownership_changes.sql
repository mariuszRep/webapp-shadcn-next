-- =====================================================
-- ROLLBACK GLOBAL OWNERSHIP CHANGES
-- =====================================================
-- This undoes the damage from 20251121000000_enable_global_ownership.sql

-- 1. Restore org_id as NOT NULL
-- -----------------------------------------------------
ALTER TABLE public.permissions ALTER COLUMN org_id SET NOT NULL;

-- 2. Remove 'system' from object_type constraint
-- -----------------------------------------------------
ALTER TABLE public.permissions DROP CONSTRAINT IF EXISTS chk_object_type;
ALTER TABLE public.permissions ADD CONSTRAINT chk_object_type
  CHECK (object_type IN ('organization', 'workspace'));

-- 3. Convert users_permissions BACK to regular VIEW
-- -----------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.users_permissions CASCADE;

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
CREATE INDEX IF NOT EXISTS idx_permissions_principal_user
ON public.permissions(principal_id, principal_type)
WHERE principal_type = 'user' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_permissions_object_lookup
ON public.permissions(object_type, object_id, deleted_at)
WHERE deleted_at IS NULL;

COMMENT ON VIEW public.users_permissions IS 'Real-time view of all user permissions across organizations and workspaces. Always up-to-date without requiring manual refresh.';
