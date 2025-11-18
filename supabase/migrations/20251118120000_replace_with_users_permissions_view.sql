-- =====================================================
-- REPLACE MATERIALIZED VIEWS WITH COMBINED VIEW
-- =====================================================
-- This migration consolidates organization_members_view and workspace_members_view
-- into a single users_permissions view for better maintainability and performance

-- First, drop policies that depend on the views
DROP POLICY IF EXISTS "allow_view_org_roles" ON public.roles;
DROP POLICY IF EXISTS "allow_create_org_roles" ON public.roles;
DROP POLICY IF EXISTS "allow_update_org_roles" ON public.roles;
DROP POLICY IF EXISTS "allow_delete_org_roles" ON public.roles;

-- Drop existing triggers and views
DROP TRIGGER IF EXISTS trg_refresh_member_views ON public.permissions;
DROP FUNCTION IF EXISTS public.refresh_member_views();
DROP MATERIALIZED VIEW IF EXISTS public.workspace_members_view;
DROP MATERIALIZED VIEW IF EXISTS public.organization_members_view;

-- =====================================================
-- CREATE COMBINED USERS PERMISSIONS VIEW
-- =====================================================
-- Single materialized view for all user permissions across object types
CREATE MATERIALIZED VIEW IF NOT EXISTS public.users_permissions AS
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

-- Create unique index for CONCURRENT refresh
CREATE UNIQUE INDEX idx_users_permissions_unique
ON public.users_permissions(org_id, object_type, object_id, user_id, role_id);

-- Additional indexes for fast lookups
CREATE INDEX idx_users_permissions_user ON public.users_permissions(user_id);
CREATE INDEX idx_users_permissions_org ON public.users_permissions(org_id);
CREATE INDEX idx_users_permissions_object ON public.users_permissions(object_type, object_id);
CREATE INDEX idx_users_permissions_org_user ON public.users_permissions(org_id, user_id);

-- =====================================================
-- SMART REFRESH TRIGGER
-- =====================================================
-- Function to refresh the combined materialized view
CREATE OR REPLACE FUNCTION public.refresh_users_permissions_view()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Refresh the single materialized view for all permission changes
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.users_permissions;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Create trigger on permissions table
CREATE TRIGGER trg_refresh_users_permissions
    AFTER INSERT OR UPDATE OR DELETE ON public.permissions
    FOR EACH ROW
    EXECUTE FUNCTION public.refresh_users_permissions_view();

-- Create trigger on roles table (since role changes affect the view)
CREATE TRIGGER trg_refresh_users_permissions_on_role_change
    AFTER UPDATE OR DELETE ON public.roles
    FOR EACH ROW
    EXECUTE FUNCTION public.refresh_users_permissions_view();

-- =====================================================
-- RECREATE RLS POLICIES WITH NEW VIEW
-- =====================================================
-- Policy: Allow users to view roles in organizations they belong to
CREATE POLICY "allow_view_org_roles"
ON public.roles
FOR SELECT
TO authenticated
USING (
  org_id IS NOT NULL
  AND deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.users_permissions up
    WHERE up.object_id = roles.org_id
      AND up.object_type = 'organization'
      AND up.user_id = auth.uid()
  )
);

-- Policy: Allow organization owners and admins to create roles
CREATE POLICY "allow_create_org_roles"
ON public.roles
FOR INSERT
TO authenticated
WITH CHECK (
  org_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.users_permissions up
    WHERE up.object_id = roles.org_id
      AND up.object_type = 'organization'
      AND up.user_id = auth.uid()
      AND up.role_name IN ('owner', 'admin')
  )
);

-- Policy: Allow organization owners and admins to update roles
CREATE POLICY "allow_update_org_roles"
ON public.roles
FOR UPDATE
TO authenticated
USING (
  org_id IS NOT NULL
  AND deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.users_permissions up
    WHERE up.object_id = roles.org_id
      AND up.object_type = 'organization'
      AND up.user_id = auth.uid()
      AND up.role_name IN ('owner', 'admin')
  )
)
WITH CHECK (
  org_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.users_permissions up
    WHERE up.object_id = roles.org_id
      AND up.object_type = 'organization'
      AND up.user_id = auth.uid()
      AND up.role_name IN ('owner', 'admin')
  )
);

-- Policy: Allow organization owners and admins to soft-delete roles
CREATE POLICY "allow_delete_org_roles"
ON public.roles
FOR DELETE
TO authenticated
USING (
  org_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.users_permissions up
    WHERE up.object_id = roles.org_id
      AND up.object_type = 'organization'
      AND up.user_id = auth.uid()
      AND up.role_name IN ('owner', 'admin')
  )
);

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================
COMMENT ON MATERIALIZED VIEW public.users_permissions IS 'Combined materialized view of all user permissions across organizations and workspaces. Automatically refreshed when permissions or roles change.';
COMMENT ON FUNCTION public.refresh_users_permissions_view() IS 'Trigger function that refreshes the users_permissions materialized view when permissions or roles change.';
COMMENT ON POLICY "allow_view_org_roles" ON public.roles IS 'Users can view roles in organizations they belong to';
COMMENT ON POLICY "allow_create_org_roles" ON public.roles IS 'Only organization owners and admins can create roles';
COMMENT ON POLICY "allow_update_org_roles" ON public.roles IS 'Only organization owners and admins can update roles';
COMMENT ON POLICY "allow_delete_org_roles" ON public.roles IS 'Only organization owners and admins can delete roles';
