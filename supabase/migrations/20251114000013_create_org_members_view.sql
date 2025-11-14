-- Create a view that joins organization_members with auth.users
-- This allows PostgREST to fetch user details with members

CREATE OR REPLACE VIEW public.organization_members_with_users AS
SELECT
  om.org_id,
  om.user_id,
  om.created_at,
  om.updated_at,
  om.created_by,
  om.updated_by,
  om.deleted_at,
  u.email as user_email,
  u.raw_user_meta_data as user_metadata
FROM public.organization_members om
INNER JOIN auth.users u ON om.user_id = u.id
WHERE om.deleted_at IS NULL;

-- Grant access to authenticated users
GRANT SELECT ON public.organization_members_with_users TO authenticated;

-- Add RLS policy
ALTER VIEW public.organization_members_with_users SET (security_invoker = true);

COMMENT ON VIEW public.organization_members_with_users IS 'View of organization members with user email from auth.users. Includes RLS policies from organization_members table.';
