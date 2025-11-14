-- Disable the on_user_login trigger that's causing the ON CONFLICT error

DROP TRIGGER IF EXISTS on_user_login ON auth.users;

COMMENT ON FUNCTION public.process_pending_invitations() IS 'TRIGGER DISABLED - Fixing ON CONFLICT constraint issue';
