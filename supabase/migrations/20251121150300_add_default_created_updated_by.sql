-- =====================================================
-- ADD DEFAULT VALUES FOR created_by AND updated_by
-- =====================================================
-- Set auth.uid() as default for created_by and updated_by columns
-- This allows INSERT without explicitly providing these values

ALTER TABLE public.organizations
  ALTER COLUMN created_by SET DEFAULT auth.uid(),
  ALTER COLUMN updated_by SET DEFAULT auth.uid();

COMMENT ON COLUMN public.organizations.created_by IS 'User who created the organization. Defaults to auth.uid()';
COMMENT ON COLUMN public.organizations.updated_by IS 'User who last updated the organization. Defaults to auth.uid()';
