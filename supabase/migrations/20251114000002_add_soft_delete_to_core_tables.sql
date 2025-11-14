-- Add soft delete support to organizations table
ALTER TABLE public.organizations
ADD COLUMN deleted_at TIMESTAMPTZ;

-- Add soft delete support to workspaces table
ALTER TABLE public.workspaces
ADD COLUMN deleted_at TIMESTAMPTZ;
