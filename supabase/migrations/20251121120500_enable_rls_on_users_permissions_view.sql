-- =====================================================
-- ENABLE RLS ON USERS_PERMISSIONS VIEW
-- =====================================================
-- Make the view execute with the invoker's permissions
-- so that RLS policies on the underlying permissions table apply

-- Drop and recreate view with security_invoker option
DROP VIEW IF EXISTS public.users_permissions;

CREATE VIEW public.users_permissions
WITH (security_invoker = true)
AS
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

COMMENT ON VIEW public.users_permissions IS 'View of user permissions that respects RLS policies on underlying permissions table';
