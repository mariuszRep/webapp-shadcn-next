-- Fix invitations RLS policy to use manage_members permission instead of manage_roles
-- This aligns with the UI which shows invitations when user has manage_members permission

-- Drop existing policies
DROP POLICY IF EXISTS invitations_select_policy ON public.invitations;
DROP POLICY IF EXISTS invitations_insert_policy ON public.invitations;
DROP POLICY IF EXISTS invitations_update_policy ON public.invitations;
DROP POLICY IF EXISTS invitations_delete_policy ON public.invitations;

-- Users can view invitations if they can manage members
CREATE POLICY invitations_select_policy ON public.invitations
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      -- Users can see invitations to their email
      email = (SELECT email FROM auth.users WHERE id = auth.uid())
      -- Or users can see invitations for organizations they can manage members
      OR has_permission('organization', 'manage_members', org_id)
    )
  );

-- Users with manage_members permission can create invitations
CREATE POLICY invitations_insert_policy ON public.invitations
  FOR INSERT
  WITH CHECK (
    has_permission('organization', 'manage_members', org_id)
  );

-- Users with manage_members permission can update invitations
CREATE POLICY invitations_update_policy ON public.invitations
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND has_permission('organization', 'manage_members', org_id)
  )
  WITH CHECK (
    deleted_at IS NULL
    AND has_permission('organization', 'manage_members', org_id)
  );

-- Users with manage_members permission can delete (soft delete) invitations
CREATE POLICY invitations_delete_policy ON public.invitations
  FOR UPDATE
  USING (
    has_permission('organization', 'manage_members', org_id)
  )
  WITH CHECK (
    has_permission('organization', 'manage_members', org_id)
  );

-- Update comment
COMMENT ON POLICY invitations_select_policy ON public.invitations IS
  'Users can view invitations sent to their email or manage invitations for organizations where they have manage_members permission';
