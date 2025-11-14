-- Fix cleanup invitations trigger

CREATE OR REPLACE FUNCTION public.cleanup_user_invitations()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Soft delete any invitations for this user's email
  UPDATE public.invitations
  SET deleted_at = now()
  WHERE email = OLD.email
    AND deleted_at IS NULL;

  RETURN OLD;
END;
$$;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_user_invitations();

COMMENT ON FUNCTION public.cleanup_user_invitations() IS 'Soft deletes invitation records when the invited user account is deleted from auth.users';
