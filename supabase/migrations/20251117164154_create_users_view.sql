-- =====================================================
-- CREATE USERS VIEW
-- =====================================================
-- Create a view of auth.users in public schema to allow querying user details
-- This is needed for permission management UI to display user names and emails

CREATE OR REPLACE VIEW public.users AS
SELECT
  id,
  email,
  raw_user_meta_data
FROM
  auth.users;

-- Grant select permission to authenticated users
GRANT SELECT ON public.users TO authenticated;

-- Add comment
COMMENT ON VIEW public.users IS 'Public view of auth.users for displaying user details in the application';
