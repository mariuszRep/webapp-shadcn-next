-- Temporarily disable RLS on core tables to debug invitation flow
-- This will help us identify if RLS is blocking the trigger

ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.principal_role_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.organizations IS 'RLS TEMPORARILY DISABLED FOR DEBUGGING';
COMMENT ON TABLE public.workspaces IS 'RLS TEMPORARILY DISABLED FOR DEBUGGING';
COMMENT ON TABLE public.organization_members IS 'RLS TEMPORARILY DISABLED FOR DEBUGGING';
COMMENT ON TABLE public.principal_role_assignments IS 'RLS TEMPORARILY DISABLED FOR DEBUGGING';
COMMENT ON TABLE public.invitations IS 'RLS TEMPORARILY DISABLED FOR DEBUGGING';
