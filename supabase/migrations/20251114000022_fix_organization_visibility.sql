-- Fix organization visibility by ensuring users can only see organizations they are members of
-- This migration addresses the issue where users could see organizations through role assignments
-- without having an organization_members entry

-- Update the has_permission function to validate organization membership first
-- This provides defense-in-depth by ensuring all permission checks validate membership
CREATE OR REPLACE FUNCTION public.has_permission(
  _resource resource_kind,
  _action TEXT,
  _org_id UUID,
  _workspace_id UUID DEFAULT NULL,
  _entity_type_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- First, validate that the user is a member of the organization
  -- This ensures we don't grant permissions without organization membership
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE org_id = _org_id
      AND user_id = current_user_id
      AND deleted_at IS NULL
  ) THEN
    RETURN FALSE;
  END IF;

  -- Check if user has permission through their roles or team roles
  RETURN EXISTS (
    WITH principals AS (
      -- User as principal
      SELECT 'user'::principal_kind AS kind, current_user_id AS id
      UNION
      -- Teams the user belongs to as principals
      SELECT 'team'::principal_kind AS kind, tm.team_id AS id
      FROM public.team_members tm
      WHERE tm.user_id = current_user_id
        AND tm.deleted_at IS NULL
    ),
    user_roles AS (
      -- Get all role assignments for the user's principals
      SELECT DISTINCT pra.role_id
      FROM public.principal_role_assignments pra
      INNER JOIN principals p ON p.kind = pra.principal_kind AND p.id = pra.principal_id
      WHERE pra.org_id = _org_id
        AND pra.deleted_at IS NULL
        AND (
          -- Org-level roles (workspace_id IS NULL) apply to all workspaces
          pra.workspace_id IS NULL
          -- Or workspace-specific roles match the requested workspace
          OR (_workspace_id IS NOT NULL AND pra.workspace_id = _workspace_id)
        )
    )
    SELECT 1
    FROM public.permissions perms
    INNER JOIN user_roles ur ON ur.role_id = perms.role_id
    WHERE perms.resource = _resource
      AND perms.action = _action
      AND perms.deleted_at IS NULL
      AND (
        -- Org-wide permissions apply everywhere in the org
        perms.apply_org_wide = TRUE
        -- Or workspace-wide permissions apply to all entities in the workspace
        OR (_workspace_id IS NOT NULL AND perms.apply_workspace_wide = TRUE)
        -- Or entity-type-specific permissions match the requested type
        OR (
          _entity_type_id IS NOT NULL
          AND perms.entity_type_id = _entity_type_id
        )
        -- Or no specific scoping required
        OR (
          perms.apply_org_wide = FALSE
          AND perms.apply_workspace_wide = FALSE
          AND perms.entity_type_id IS NULL
        )
      )
  );
END;
$$;

-- Drop and recreate the organizations select policy to remove the OR has_permission clause
DROP POLICY IF EXISTS organizations_select_policy ON public.organizations;

CREATE POLICY organizations_select_policy ON public.organizations
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_org_member(id)
  );

-- Add a comment to document the policy
COMMENT ON POLICY organizations_select_policy ON public.organizations IS
  'Users can only view organizations where they have an organization_members entry. This is the primary authorization check.';
