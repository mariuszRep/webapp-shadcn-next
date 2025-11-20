-- =====================================================
-- REMOVE RLS AND POLICIES
-- =====================================================
-- This migration removes all Row Level Security (RLS) policies
-- and disables RLS on all tables to allow unrestricted access.

-- 1. Drop all existing policies
-- Invitations
DROP POLICY IF EXISTS "Users can view invitations they created" ON public.invitations;
DROP POLICY IF EXISTS "Users can view their own invitations" ON public.invitations;

-- Organizations
DROP POLICY IF EXISTS "allow_create_organizations" ON public.organizations;
DROP POLICY IF EXISTS "allow_delete_organizations" ON public.organizations;
DROP POLICY IF EXISTS "allow_delete_owner_organizations" ON public.organizations;
DROP POLICY IF EXISTS "allow_insert_organizations" ON public.organizations;
DROP POLICY IF EXISTS "allow_select_member_organizations" ON public.organizations;
DROP POLICY IF EXISTS "allow_update_member_organizations" ON public.organizations;
DROP POLICY IF EXISTS "allow_update_organizations" ON public.organizations;
DROP POLICY IF EXISTS "allow_view_organizations" ON public.organizations;

-- Roles
DROP POLICY IF EXISTS "allow_create_org_roles" ON public.roles;
DROP POLICY IF EXISTS "allow_delete_org_roles" ON public.roles;
DROP POLICY IF EXISTS "allow_update_org_roles" ON public.roles;
DROP POLICY IF EXISTS "allow_view_org_roles" ON public.roles;
DROP POLICY IF EXISTS "allow_view_system_roles" ON public.roles;

-- 2. Disable RLS on all tables
ALTER TABLE public.invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces DISABLE ROW LEVEL SECURITY;
