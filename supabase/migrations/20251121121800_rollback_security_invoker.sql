-- =====================================================
-- ROLLBACK SECURITY_INVOKER ON VIEW
-- =====================================================
-- The security_invoker causes complex nested RLS checks
-- Instead, rely on the underlying permissions table RLS

DROP VIEW IF EXISTS public.users_permissions;

CREATE VIEW public.users_permissions AS
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

COMMENT ON VIEW public.users_permissions IS 'View of user permissions. RLS is enforced by underlying permissions table.';
