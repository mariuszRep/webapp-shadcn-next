-- Fix invitations view to properly handle RLS
-- The issue is that views need explicit RLS policies or use security definer functions

-- Drop the existing view
DROP VIEW IF EXISTS public.invitations_with_details;

-- Create a function instead of a view for better RLS handling
CREATE OR REPLACE FUNCTION public.get_invitations_with_details(p_org_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  org_id UUID,
  invited_by UUID,
  role_id UUID,
  accepted_at TIMESTAMPTZ,
  expiry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  invited_by_email TEXT,
  role_id_actual UUID,
  role_name TEXT,
  role_description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has permission to view invitations for this org
  IF NOT has_permission('organization', 'manage_members', p_org_id) THEN
    -- Also check if any of the invitations are for the current user's email
    IF NOT EXISTS (
      SELECT 1 FROM public.invitations
      WHERE org_id = p_org_id
        AND email = (SELECT email FROM auth.users WHERE auth.users.id = auth.uid())
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Permission denied';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.email,
    i.org_id,
    i.invited_by,
    i.role_id,
    i.accepted_at,
    i.expiry_at,
    i.created_at,
    i.updated_at,
    i.deleted_at,
    u.email as invited_by_email,
    r.id as role_id_actual,
    r.name as role_name,
    r.description as role_description
  FROM public.invitations i
  LEFT JOIN auth.users u ON i.invited_by = u.id
  LEFT JOIN public.roles r ON i.role_id = r.id
  WHERE i.org_id = p_org_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_invitations_with_details(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_invitations_with_details(UUID) IS
  'Returns invitations for an organization with user and role details. Checks manage_members permission or if invitation is for current user.';
