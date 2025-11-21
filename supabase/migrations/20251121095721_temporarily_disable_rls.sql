-- =====================================================
-- TEMPORARILY DISABLE RLS ON ORGANIZATIONS AND WORKSPACES
-- =====================================================
-- This allows bootstrapping - users need to create orgs/workspaces before permissions exist

-- Disable RLS temporarily to allow bootstrapping
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces DISABLE ROW LEVEL SECURITY;

-- Note: permissions and roles still have RLS enabled
-- We'll re-enable org/workspace RLS after fixing the bootstrapping issue
