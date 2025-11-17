-- Create a view that joins invitations with auth.users and roles
-- This allows PostgREST to fetch user details and role details with invitations

CREATE OR REPLACE VIEW public.invitations_with_details AS
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
LEFT JOIN public.roles r ON i.role_id = r.id;

-- Grant access to authenticated users
GRANT SELECT ON public.invitations_with_details TO authenticated;

-- Add RLS policy
ALTER VIEW public.invitations_with_details SET (security_invoker = true);

COMMENT ON VIEW public.invitations_with_details IS 'View of invitations with invited_by user email from auth.users and role details. Includes RLS policies from invitations table.';
