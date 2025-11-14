-- Helper function to check if current user is a member of an organization
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE org_id = _org_id
      AND user_id = auth.uid()
      AND deleted_at IS NULL
  );
END;
$$;

-- Central permission checking function
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

-- Enable RLS on organizations table
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Organizations: Allow members to view their organizations
CREATE POLICY organizations_select_policy ON public.organizations
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      is_org_member(id)
      OR has_permission('organization', 'read', id)
    )
  );

-- Organizations: Allow users with update permission to update
CREATE POLICY organizations_update_policy ON public.organizations
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND has_permission('organization', 'update', id)
  )
  WITH CHECK (
    deleted_at IS NULL
    AND has_permission('organization', 'update', id)
  );

-- Organizations: Allow users with delete permission to delete (soft delete)
CREATE POLICY organizations_delete_policy ON public.organizations
  FOR UPDATE
  USING (
    has_permission('organization', 'delete', id)
  )
  WITH CHECK (
    has_permission('organization', 'delete', id)
  );

-- Enable RLS on workspaces table
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Workspaces: Allow users with read permission to view workspaces
CREATE POLICY workspaces_select_policy ON public.workspaces
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND has_permission('workspace', 'read', organization_id, id)
  );

-- Workspaces: Allow users with create permission to create workspaces
CREATE POLICY workspaces_insert_policy ON public.workspaces
  FOR INSERT
  WITH CHECK (
    has_permission('workspace', 'create', organization_id)
  );

-- Workspaces: Allow users with update permission to update workspaces
CREATE POLICY workspaces_update_policy ON public.workspaces
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND has_permission('workspace', 'update', organization_id, id)
  )
  WITH CHECK (
    deleted_at IS NULL
    AND has_permission('workspace', 'update', organization_id, id)
  );

-- Workspaces: Allow users with delete permission to delete (soft delete)
CREATE POLICY workspaces_delete_policy ON public.workspaces
  FOR UPDATE
  USING (
    has_permission('workspace', 'delete', organization_id, id)
  )
  WITH CHECK (
    has_permission('workspace', 'delete', organization_id, id)
  );

-- Enable RLS on teams table
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Teams: Allow org members to view teams in their organization
CREATE POLICY teams_select_policy ON public.teams
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_org_member(org_id)
  );

-- Teams: Allow users with manage_teams permission to create teams
CREATE POLICY teams_insert_policy ON public.teams
  FOR INSERT
  WITH CHECK (
    has_permission('organization', 'manage_teams', org_id)
  );

-- Teams: Allow users with manage_teams permission to update teams
CREATE POLICY teams_update_policy ON public.teams
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND has_permission('organization', 'manage_teams', org_id)
  )
  WITH CHECK (
    deleted_at IS NULL
    AND has_permission('organization', 'manage_teams', org_id)
  );

-- Teams: Allow users with manage_teams permission to delete (soft delete)
CREATE POLICY teams_delete_policy ON public.teams
  FOR UPDATE
  USING (
    has_permission('organization', 'manage_teams', org_id)
  )
  WITH CHECK (
    has_permission('organization', 'manage_teams', org_id)
  );

-- Enable RLS on team_members table
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Team Members: Allow org members to view team memberships
CREATE POLICY team_members_select_policy ON public.team_members
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = team_members.team_id
        AND t.deleted_at IS NULL
        AND is_org_member(t.org_id)
    )
  );

-- Team Members: Allow users with manage_teams permission to add members
CREATE POLICY team_members_insert_policy ON public.team_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = team_members.team_id
        AND t.deleted_at IS NULL
        AND has_permission('organization', 'manage_teams', t.org_id)
    )
  );

-- Team Members: Allow users with manage_teams permission to update members
CREATE POLICY team_members_update_policy ON public.team_members
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = team_members.team_id
        AND t.deleted_at IS NULL
        AND has_permission('organization', 'manage_teams', t.org_id)
    )
  )
  WITH CHECK (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = team_members.team_id
        AND t.deleted_at IS NULL
        AND has_permission('organization', 'manage_teams', t.org_id)
    )
  );

-- Team Members: Allow users with manage_teams permission to delete (soft delete)
CREATE POLICY team_members_delete_policy ON public.team_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = team_members.team_id
        AND t.deleted_at IS NULL
        AND has_permission('organization', 'manage_teams', t.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = team_members.team_id
        AND t.deleted_at IS NULL
        AND has_permission('organization', 'manage_teams', t.org_id)
    )
  );

-- Enable RLS on principal_role_assignments table
ALTER TABLE public.principal_role_assignments ENABLE ROW LEVEL SECURITY;

-- Role Assignments: Allow org members to view role assignments
CREATE POLICY role_assignments_select_policy ON public.principal_role_assignments
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_org_member(org_id)
  );

-- Role Assignments: Allow users with manage_roles permission to create assignments
CREATE POLICY role_assignments_insert_policy ON public.principal_role_assignments
  FOR INSERT
  WITH CHECK (
    has_permission('organization', 'manage_roles', org_id)
  );

-- Role Assignments: Allow users with manage_roles permission to update assignments
CREATE POLICY role_assignments_update_policy ON public.principal_role_assignments
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND has_permission('organization', 'manage_roles', org_id)
  )
  WITH CHECK (
    deleted_at IS NULL
    AND has_permission('organization', 'manage_roles', org_id)
  );

-- Role Assignments: Allow users with manage_roles permission to delete (soft delete)
CREATE POLICY role_assignments_delete_policy ON public.principal_role_assignments
  FOR UPDATE
  USING (
    has_permission('organization', 'manage_roles', org_id)
  )
  WITH CHECK (
    has_permission('organization', 'manage_roles', org_id)
  );
