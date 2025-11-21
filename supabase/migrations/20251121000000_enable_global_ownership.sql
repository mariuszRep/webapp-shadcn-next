-- =====================================================
-- ENABLE GLOBAL OWNERSHIP
-- =====================================================

-- 1. Modify permissions table to allow global permissions
-- -----------------------------------------------------
ALTER TABLE public.permissions ALTER COLUMN org_id DROP NOT NULL;

ALTER TABLE public.permissions DROP CONSTRAINT chk_object_type;
ALTER TABLE public.permissions ADD CONSTRAINT chk_object_type 
  CHECK (object_type IN ('organization', 'workspace', 'system'));

-- 2. Update users_permissions view
-- -----------------------------------------------------
DROP VIEW IF EXISTS public.users_permissions CASCADE;

CREATE MATERIALIZED VIEW public.users_permissions AS
 SELECT DISTINCT "p"."org_id",
    "p"."object_type",
    "p"."object_id",
    "p"."principal_id" AS "user_id",
    "p"."role_id",
    "r"."name" AS "role_name",
    "r"."permissions" AS "role_permissions"
   FROM ("public"."permissions" "p"
     JOIN "public"."roles" "r" ON (("p"."role_id" = "r"."id")))
  WHERE (("p"."principal_type" = 'user'::"text") AND ("p"."deleted_at" IS NULL) AND ("r"."deleted_at" IS NULL)
    AND (("p"."object_id" IS NOT NULL) OR ("p"."object_type" = 'system'::"text")));

-- Recreate indexes
CREATE INDEX "idx_users_permissions_object" ON "public"."users_permissions" USING "btree" ("object_type", "object_id");
CREATE INDEX "idx_users_permissions_org" ON "public"."users_permissions" USING "btree" ("org_id");
CREATE INDEX "idx_users_permissions_org_user" ON "public"."users_permissions" USING "btree" ("org_id", "user_id");
CREATE INDEX "idx_users_permissions_user" ON "public"."users_permissions" USING "btree" ("user_id");
CREATE UNIQUE INDEX "idx_users_permissions_unique" ON "public"."users_permissions" USING "btree" ("org_id", "object_type", "object_id", "user_id", "role_id");

-- 3. Update RLS Policies
-- -----------------------------------------------------

-- Drop existing policies to recreate them with global access
DROP POLICY IF EXISTS "select_organizations" ON public.organizations;
DROP POLICY IF EXISTS "select_workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "select_roles" ON public.roles;
DROP POLICY IF EXISTS "select_permissions" ON public.permissions;

-- Organizations: Users see orgs they have permissions on OR if they are global owner
CREATE POLICY "select_organizations" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT object_id
      FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND object_type = 'organization'
        AND deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND object_type = 'system'
        AND deleted_at IS NULL
    )
  );

COMMENT ON POLICY "select_organizations" ON public.organizations IS 'Users can see organizations they have permissions on, or all if global owner';

-- Workspaces: Users see workspaces with direct/inherited permission OR if they are global owner
CREATE POLICY "select_workspaces" ON public.workspaces
  FOR SELECT TO authenticated
  USING (
    -- Direct workspace permission
    id IN (
      SELECT object_id
      FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND object_type = 'workspace'
        AND deleted_at IS NULL
    )
    OR
    -- Inherited from organization
    organization_id IN (
      SELECT object_id
      FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND object_type = 'organization'
        AND deleted_at IS NULL
    )
    OR
    -- Global owner
    EXISTS (
      SELECT 1 FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND object_type = 'system'
        AND deleted_at IS NULL
    )
  );

COMMENT ON POLICY "select_workspaces" ON public.workspaces IS 'Users can see workspaces they have access to, or all if global owner';

-- Roles: Users see roles they have been assigned OR if they are global owner
CREATE POLICY "select_roles" ON public.roles
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT role_id
      FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND deleted_at IS NULL
    )
    OR
    -- Global owner sees all roles (or maybe just system roles? Assuming all for now)
    EXISTS (
      SELECT 1 FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND object_type = 'system'
        AND deleted_at IS NULL
    )
  );

COMMENT ON POLICY "select_roles" ON public.roles IS 'Users can see roles they have been assigned, or all if global owner';

-- Permissions: Users see their own permissions OR all permissions if global owner
CREATE POLICY "select_permissions" ON public.permissions
  FOR SELECT TO authenticated
  USING (
    (principal_type = 'user' AND principal_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.permissions
      WHERE principal_type = 'user'
        AND principal_id = auth.uid()
        AND object_type = 'system'
        AND deleted_at IS NULL
    )
  );

COMMENT ON POLICY "select_permissions" ON public.permissions IS 'Users can see their own permissions, or all if global owner';
