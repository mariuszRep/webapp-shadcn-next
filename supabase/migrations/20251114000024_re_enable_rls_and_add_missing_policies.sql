-- Re-enable RLS on all tables that were disabled for debugging
-- This migration addresses the security issue where RLS was disabled in migration 20251114000016

-- Re-enable RLS on core tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.principal_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Update comments to reflect RLS is now enabled
COMMENT ON TABLE public.organizations IS 'Organizations table with RLS enabled';
COMMENT ON TABLE public.workspaces IS 'Workspaces table with RLS enabled';
COMMENT ON TABLE public.organization_members IS 'Organization membership junction table with RLS enabled';
COMMENT ON TABLE public.principal_role_assignments IS 'Role assignments table with RLS enabled';
COMMENT ON TABLE public.invitations IS 'Invitations table with RLS enabled';

-- Add RLS policies for organization_members table
-- Users can view memberships for organizations they belong to
CREATE POLICY organization_members_select_policy ON public.organization_members
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      -- Users can see their own memberships
      user_id = auth.uid()
      -- Or users can see memberships of organizations they belong to
      OR is_org_member(org_id)
    )
  );

-- Users with manage_roles permission can insert members
CREATE POLICY organization_members_insert_policy ON public.organization_members
  FOR INSERT
  WITH CHECK (
    has_permission('organization', 'manage_roles', org_id)
  );

-- Users with manage_roles permission can update members
CREATE POLICY organization_members_update_policy ON public.organization_members
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND has_permission('organization', 'manage_roles', org_id)
  )
  WITH CHECK (
    deleted_at IS NULL
    AND has_permission('organization', 'manage_roles', org_id)
  );

-- Users with manage_roles permission can delete (soft delete) members
CREATE POLICY organization_members_delete_policy ON public.organization_members
  FOR UPDATE
  USING (
    has_permission('organization', 'manage_roles', org_id)
  )
  WITH CHECK (
    has_permission('organization', 'manage_roles', org_id)
  );

-- Add RLS policies for invitations table
-- Users can view invitations sent to their email
CREATE POLICY invitations_select_policy ON public.invitations
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      -- Users can see invitations to their email
      email = (SELECT email FROM auth.users WHERE id = auth.uid())
      -- Or users can see invitations for organizations they can manage
      OR has_permission('organization', 'manage_roles', org_id)
    )
  );

-- Users with manage_roles permission can create invitations
CREATE POLICY invitations_insert_policy ON public.invitations
  FOR INSERT
  WITH CHECK (
    has_permission('organization', 'manage_roles', org_id)
  );

-- Users with manage_roles permission can update invitations
CREATE POLICY invitations_update_policy ON public.invitations
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND has_permission('organization', 'manage_roles', org_id)
  )
  WITH CHECK (
    deleted_at IS NULL
    AND has_permission('organization', 'manage_roles', org_id)
  );

-- Users with manage_roles permission can delete (soft delete) invitations
CREATE POLICY invitations_delete_policy ON public.invitations
  FOR UPDATE
  USING (
    has_permission('organization', 'manage_roles', org_id)
  )
  WITH CHECK (
    has_permission('organization', 'manage_roles', org_id)
  );

-- Add RLS policies for roles table (read-only for all authenticated users)
CREATE POLICY roles_select_policy ON public.roles
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND auth.uid() IS NOT NULL
  );

-- Add RLS policies for permissions table (read-only for all authenticated users)
CREATE POLICY permissions_select_policy ON public.permissions
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND auth.uid() IS NOT NULL
  );

-- Add comments explaining the policies
COMMENT ON POLICY organization_members_select_policy ON public.organization_members IS
  'Users can view their own memberships and memberships of organizations they belong to';

COMMENT ON POLICY invitations_select_policy ON public.invitations IS
  'Users can view invitations sent to their email or manage invitations for organizations they can manage';

COMMENT ON POLICY roles_select_policy ON public.roles IS
  'All authenticated users can read roles (needed for permission checks)';

COMMENT ON POLICY permissions_select_policy ON public.permissions IS
  'All authenticated users can read permissions (needed for permission checks)';
