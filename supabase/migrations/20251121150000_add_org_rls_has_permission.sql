-- =====================================================
-- CREATE has_permission FUNCTION
-- =====================================================
-- Purpose: Centralized permission checking function for RLS policies
-- Maps SQL actions (select, insert, update, delete) to permission actions (read, create, update, delete)
-- Checks if user has the required permission on a specific object

CREATE OR REPLACE FUNCTION public.has_permission(
  table_name_param TEXT,
  action_param TEXT,
  org_id_param UUID,
  row_id_param UUID DEFAULT NULL,
  workspace_id_param UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  permission_action TEXT;
BEGIN
  -- Map SQL actions to permission actions
  permission_action := CASE action_param
    WHEN 'select' THEN 'read'
    WHEN 'insert' THEN 'create'
    WHEN 'update' THEN 'update'
    WHEN 'delete' THEN 'delete'
    ELSE action_param
  END;

  -- Check if user has permission
  RETURN EXISTS (
    SELECT 1
    FROM public.permissions p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.principal_type = 'user'
      AND p.principal_id = auth.uid()
      AND p.org_id = org_id_param
      AND p.object_type = table_name_param
      -- Match either:
      -- 1. Table-level permission (object_id IS NULL) OR
      -- 2. Row-level permission (object_id matches row_id_param)
      AND (p.object_id IS NULL OR p.object_id = row_id_param)
      -- For workspace-scoped objects, also check workspace permission
      AND (workspace_id_param IS NULL OR p.object_type = 'workspace' AND p.object_id = workspace_id_param)
      AND r.permissions ? permission_action
      AND p.deleted_at IS NULL
      AND r.deleted_at IS NULL
  );
END;
$$;

COMMENT ON FUNCTION public.has_permission IS 'Checks if the current user has a specific permission on an object. Used by RLS policies.';

-- =====================================================
-- APPLY INSERT/UPDATE/DELETE POLICIES TO ORGANIZATIONS TABLE
-- =====================================================
-- Note: SELECT policy already exists and is working - do NOT modify it
-- Only adding INSERT, UPDATE, DELETE policies

-- Drop existing INSERT/UPDATE/DELETE policies if they exist
DROP POLICY IF EXISTS "insert_organizations" ON public.organizations;
DROP POLICY IF EXISTS "update_organizations" ON public.organizations;
DROP POLICY IF EXISTS "delete_organizations" ON public.organizations;

-- =====================================================
-- UPDATE POLICY with has_permission
-- =====================================================
CREATE POLICY "Users can update orgs with permission" ON public.organizations
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(
      'organization',  -- table_name
      'update',        -- action
      id,              -- org_id
      id,              -- row_id
      NULL             -- workspace_id
    )
  )
  WITH CHECK (
    public.has_permission(
      'organization',
      'update',
      id,
      id,
      NULL
    )
  );

COMMENT ON POLICY "Users can update orgs with permission" ON public.organizations IS 'Users can update organizations where they have update permission';

-- =====================================================
-- DELETE POLICY with has_permission
-- =====================================================
CREATE POLICY "Users can delete orgs with permission" ON public.organizations
  FOR DELETE TO authenticated
  USING (
    public.has_permission(
      'organization',  -- table_name
      'delete',        -- action
      id,              -- org_id
      id,              -- row_id
      NULL             -- workspace_id
    )
  );

COMMENT ON POLICY "Users can delete orgs with permission" ON public.organizations IS 'Users can delete organizations where they have delete permission';

-- =====================================================
-- INSERT POLICY with has_permission
-- =====================================================
-- Note: For INSERT, we check if user has create permission at org-level
-- Since the org doesn't exist yet, we check for system-level permission
-- This might need adjustment based on your specific requirements
CREATE POLICY "Users can create orgs with permission" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Allow if user has any organization-level create permission
    -- (object_id IS NULL means org-level permission)
    EXISTS (
      SELECT 1
      FROM public.permissions p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.principal_type = 'user'
        AND p.principal_id = auth.uid()
        AND p.object_type = 'organization'
        AND p.object_id IS NULL  -- System/org-level permission
        AND r.permissions ? 'create'
        AND p.deleted_at IS NULL
        AND r.deleted_at IS NULL
    )
    -- OR allow organization creator (owner role will be assigned by trigger)
    OR auth.uid() = created_by
  );

COMMENT ON POLICY "Users can create orgs with permission" ON public.organizations IS 'Users can create organizations if they have system-level create permission OR are the creator (owner role assigned via trigger)';
