-- =====================================================
-- CONVERT MATERIALIZED VIEW TO REGULAR VIEW
-- =====================================================
-- This fixes the error "materialized view has not been populated"
-- Regular views are always up-to-date and don't require REFRESH

-- Drop refresh triggers if they exist
DROP TRIGGER IF EXISTS trg_refresh_users_permissions ON public.permissions;
DROP TRIGGER IF EXISTS trg_refresh_users_permissions_on_role_change ON public.roles;
DROP FUNCTION IF EXISTS public.refresh_users_permissions_view();

-- Drop the materialized view (CASCADE will drop and recreate dependent policies)
DROP MATERIALIZED VIEW IF EXISTS public.users_permissions CASCADE;

-- Create as a regular VIEW instead (same definition as before)
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

-- Update comment
COMMENT ON VIEW public.users_permissions IS 'Real-time view of all user permissions across organizations and workspaces. Always up-to-date without requiring manual refresh.';

-- Recreate the policies that were dropped by CASCADE
-- These are the exact policies from the remote schema

-- Organizations policies
CREATE POLICY allow_select_member_organizations ON public.organizations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users_permissions up
      WHERE up.object_id = organizations.id
        AND up.object_type = 'organization'
        AND up.user_id = auth.uid()
    )
  );

CREATE POLICY allow_update_member_organizations ON public.organizations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users_permissions up
      WHERE up.object_id = organizations.id
        AND up.object_type = 'organization'
        AND up.user_id = auth.uid()
        AND up.role_name = ANY(ARRAY['owner', 'admin'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users_permissions up
      WHERE up.object_id = organizations.id
        AND up.object_type = 'organization'
        AND up.user_id = auth.uid()
        AND up.role_name = ANY(ARRAY['owner', 'admin'])
    )
  );

CREATE POLICY allow_delete_owner_organizations ON public.organizations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users_permissions up
      WHERE up.object_id = organizations.id
        AND up.object_type = 'organization'
        AND up.user_id = auth.uid()
        AND up.role_name = 'owner'
    )
  );

-- Roles policies
CREATE POLICY allow_create_org_roles ON public.roles
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.users_permissions up
      WHERE up.object_id = roles.org_id
        AND up.object_type = 'organization'
        AND up.user_id = auth.uid()
        AND up.role_name = ANY(ARRAY['owner', 'admin'])
    )
  );

CREATE POLICY allow_update_org_roles ON public.roles
  FOR UPDATE TO authenticated
  USING (
    org_id IS NOT NULL
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.users_permissions up
      WHERE up.object_id = roles.org_id
        AND up.object_type = 'organization'
        AND up.user_id = auth.uid()
        AND up.role_name = ANY(ARRAY['owner', 'admin'])
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
        AND up.role_name = ANY(ARRAY['owner', 'admin'])
    )
  );

CREATE POLICY allow_delete_org_roles ON public.roles
  FOR DELETE TO authenticated
  USING (
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.users_permissions up
      WHERE up.object_id = roles.org_id
        AND up.object_type = 'organization'
        AND up.user_id = auth.uid()
        AND up.role_name = ANY(ARRAY['owner', 'admin'])
    )
  );

-- Add policy comments
COMMENT ON POLICY allow_select_member_organizations ON public.organizations IS 'Users can view organizations they are members of';
COMMENT ON POLICY allow_update_member_organizations ON public.organizations IS 'Only organization owners and admins can update organization details';
COMMENT ON POLICY allow_delete_owner_organizations ON public.organizations IS 'Only organization owners can delete organizations';
COMMENT ON POLICY allow_create_org_roles ON public.roles IS 'Only organization owners and admins can create roles';
COMMENT ON POLICY allow_update_org_roles ON public.roles IS 'Only organization owners and admins can update roles';
COMMENT ON POLICY allow_delete_org_roles ON public.roles IS 'Only organization owners and admins can delete roles';
