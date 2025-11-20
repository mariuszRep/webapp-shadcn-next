-- =====================================================
-- ROLLBACK RLS POLICIES
-- =====================================================
-- This migration drops all policies and functions created in the previous migration

-- Drop all policies on permissions table
DROP POLICY IF EXISTS "permissions_select_policy" ON public.permissions;
DROP POLICY IF EXISTS "permissions_insert_policy" ON public.permissions;
DROP POLICY IF EXISTS "permissions_update_policy" ON public.permissions;
DROP POLICY IF EXISTS "permissions_delete_policy" ON public.permissions;

-- Drop all policies on roles table
DROP POLICY IF EXISTS "roles_select_policy" ON public.roles;
DROP POLICY IF EXISTS "roles_insert_policy" ON public.roles;
DROP POLICY IF EXISTS "roles_update_policy" ON public.roles;
DROP POLICY IF EXISTS "roles_delete_policy" ON public.roles;

-- Drop helper function
DROP FUNCTION IF EXISTS public.has_role(uuid, uuid, text[]);

-- Disable RLS on tables
ALTER TABLE public.permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
