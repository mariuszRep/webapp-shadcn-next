-- Disable the trigger completely to allow user creation
-- We'll debug the trigger separately and re-enable once fixed

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

COMMENT ON FUNCTION public.handle_new_user() IS 'TRIGGER DISABLED - Debugging user creation issue';
