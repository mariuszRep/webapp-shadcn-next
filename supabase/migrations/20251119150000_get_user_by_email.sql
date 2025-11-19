-- Create a secure function to look up users by email
-- This allows the service role to check for existing users reliably without exposing auth.users to everyone

CREATE OR REPLACE FUNCTION public.get_user_by_email(email text)
RETURNS TABLE (
  id uuid,
  email varchar
)
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the executing user is a service_role (admin)
  -- We can check the role or just rely on REVOKE EXECUTE from PUBLIC
  
  RETURN QUERY
  SELECT au.id, au.email::varchar
  FROM auth.users au
  WHERE au.email ILIKE get_user_by_email.email
  LIMIT 1;
END;
$$;

-- Revoke execution from public and authenticated users
-- Only service_role (admin client) should be able to call this
REVOKE EXECUTE ON FUNCTION public.get_user_by_email(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_by_email(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_by_email(text) FROM anon;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION public.get_user_by_email(text) TO service_role;

-- Add comment
COMMENT ON FUNCTION public.get_user_by_email(text) IS 'Securely looks up a user by email (case-insensitive). Only callable by service_role.';
