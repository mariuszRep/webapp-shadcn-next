-- Add missing unique constraints that ON CONFLICT clauses need

-- Drop existing constraint if it exists
ALTER TABLE public.principal_role_assignments
DROP CONSTRAINT IF EXISTS principal_role_assignments_unique;

-- Add unique index on principal_role_assignments
-- Use NULLS NOT DISTINCT to treat NULL workspace_id values as equal
-- This allows ON CONFLICT (principal_kind, principal_id, org_id, workspace_id, role_id) to work
CREATE UNIQUE INDEX IF NOT EXISTS principal_role_assignments_unique_idx
ON public.principal_role_assignments (principal_kind, principal_id, org_id, workspace_id, role_id)
NULLS NOT DISTINCT;

COMMENT ON INDEX public.principal_role_assignments_unique_idx
IS 'Ensures a principal can only have a specific role once per org/workspace combination. Treats NULL workspace_id values as equal.';
