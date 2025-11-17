-- Alter roles table to allow NULL values for created_by and updated_by
-- This is needed for system-wide roles that don't have a creator
ALTER TABLE public.roles
  ALTER COLUMN created_by DROP NOT NULL,
  ALTER COLUMN updated_by DROP NOT NULL;

COMMENT ON COLUMN public.roles.created_by IS 'User who created the role. NULL for system-wide roles.';
COMMENT ON COLUMN public.roles.updated_by IS 'User who last updated the role. NULL for system-wide roles.';
