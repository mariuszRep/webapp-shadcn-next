


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'Auto-provisioning removed. Users go through onboarding flow to create organizations and workspaces. Ownership is automatically assigned via triggers on organizations and workspaces tables.';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."invitation_status" AS ENUM (
    'pending',
    'accepted',
    'expired'
);


ALTER TYPE "public"."invitation_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_owner_role"("object_id_param" "uuid", "user_id_param" "uuid", "object_type_param" "text", "org_id_param" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    owner_role_id UUID;
BEGIN
    -- Fetch the system-wide 'owner' role ID
    SELECT id INTO owner_role_id FROM public.roles WHERE name = 'owner' AND org_id IS NULL LIMIT 1;
    IF owner_role_id IS NULL THEN
        RAISE EXCEPTION 'Owner role not found';
    END IF;
    -- Insert permission for the owner role
    INSERT INTO public.permissions (org_id, principal_type, principal_id, role_id, object_type, object_id, created_by, updated_by)
    VALUES (org_id_param, 'user', user_id_param, owner_role_id, object_type_param, object_id_param, user_id_param, user_id_param);
END;
$$;


ALTER FUNCTION "public"."assign_owner_role"("object_id_param" "uuid", "user_id_param" "uuid", "object_type_param" "text", "org_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_ownership"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF TG_TABLE_NAME = 'organizations' THEN
        PERFORM public.assign_owner_role(NEW.id, NEW.created_by, 'organization', NEW.id);
    ELSIF TG_TABLE_NAME = 'workspaces' THEN
        PERFORM public.assign_owner_role(NEW.id, NEW.created_by, 'workspace', NEW.organization_id);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_ownership"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_organization_permissions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  BEGIN
      -- Delete all permissions associated with this organization
      DELETE FROM public.permissions
      WHERE object_type = 'organization'
        AND object_id = OLD.id;

      RETURN OLD;
  END;
  $$;


ALTER FUNCTION "public"."delete_organization_permissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_workspace_permissions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  BEGIN
      -- Delete all permissions associated with this workspace
      DELETE FROM public.permissions
      WHERE object_type = 'workspace'
        AND object_id = OLD.id;

      RETURN OLD;
  END;
  $$;


ALTER FUNCTION "public"."delete_workspace_permissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_by_email"("user_email" "text") RETURNS TABLE("id" "uuid", "email" character varying)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Check if the executing user is a service_role (admin)
  -- We can check the role or just rely on REVOKE EXECUTE from PUBLIC

  RETURN QUERY
  SELECT au.id, au.email::varchar
  FROM auth.users au
  WHERE au.email ILIKE user_email
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_user_by_email"("user_email" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_by_email"("user_email" "text") IS 'Securely looks up a user by email (case-insensitive). Only callable by service_role.';



CREATE OR REPLACE FUNCTION "public"."refresh_users_permissions_view"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  BEGIN
      -- Refresh the materialized view when permissions change
      REFRESH MATERIALIZED VIEW CONCURRENTLY public.users_permissions;

      IF TG_OP = 'DELETE' THEN
          RETURN OLD;
      ELSE
          RETURN NEW;
      END IF;
  END;
  $$;


ALTER FUNCTION "public"."refresh_users_permissions_view"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "public"."invitation_status" DEFAULT 'pending'::"public"."invitation_status" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


COMMENT ON TABLE "public"."organizations" IS 'Organizations table for multi-tenant architecture';



CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "principal_type" "text" NOT NULL,
    "principal_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "object_type" "text" NOT NULL,
    "object_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid" NOT NULL,
    CONSTRAINT "chk_object_type" CHECK (("object_type" = ANY (ARRAY['organization'::"text", 'workspace'::"text"]))),
    CONSTRAINT "chk_principal_type" CHECK (("principal_type" = ANY (ARRAY['user'::"text", 'team'::"text"])))
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."permissions" IS 'Role-based object permission model. Assigns roles to principals (users, teams) for specific objects (organizations, workspaces). Uses SQL-aligned action terminology.';



COMMENT ON COLUMN "public"."permissions"."org_id" IS 'Organization this permission belongs to. All permissions are scoped to an organization.';



COMMENT ON COLUMN "public"."permissions"."principal_type" IS 'Type of principal: ''user'' (auth.users.id) or ''team'' (teams.id for future use)';



COMMENT ON COLUMN "public"."permissions"."principal_id" IS 'ID of the principal (user, team, or api_key) receiving the permission';



COMMENT ON COLUMN "public"."permissions"."role_id" IS 'Role assigned to the principal for this object';



COMMENT ON COLUMN "public"."permissions"."object_type" IS 'Type of object: ''organization'' or ''workspace''';



COMMENT ON COLUMN "public"."permissions"."object_id" IS 'Specific object ID. NULL means permission applies to all objects of this type, non-null means specific object only.';



COMMENT ON COLUMN "public"."permissions"."deleted_at" IS 'Soft delete timestamp. NULL means active, non-null means deleted.';



CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "permissions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "org_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "chk_role_name_not_empty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."roles" IS 'Defines permission sets that can be assigned to principals. Roles contain a JSONB array of allowed actions (read, create, update, delete).';



COMMENT ON COLUMN "public"."roles"."name" IS 'Role name (e.g., admin, member, viewer)';



COMMENT ON COLUMN "public"."roles"."permissions" IS 'JSONB array of SQL-aligned actions: ["select", "insert", "update", "delete"]';



COMMENT ON COLUMN "public"."roles"."org_id" IS 'Organization this role belongs to. NULL means system-wide role.';



COMMENT ON COLUMN "public"."roles"."deleted_at" IS 'Soft delete timestamp. NULL means active, non-null means deleted.';



COMMENT ON COLUMN "public"."roles"."created_by" IS 'User who created the role. NULL for system-wide roles.';



COMMENT ON COLUMN "public"."roles"."updated_by" IS 'User who last updated the role. NULL for system-wide roles.';



CREATE OR REPLACE VIEW "public"."users" AS
 SELECT "id",
    "email",
    "raw_user_meta_data"
   FROM "auth"."users";


ALTER VIEW "public"."users" OWNER TO "postgres";


COMMENT ON VIEW "public"."users" IS 'Public view of auth.users for displaying user details in the application';



CREATE MATERIALIZED VIEW "public"."users_permissions" AS
 SELECT DISTINCT "p"."org_id",
    "p"."object_type",
    "p"."object_id",
    "p"."principal_id" AS "user_id",
    "p"."role_id",
    "r"."name" AS "role_name",
    "r"."permissions" AS "role_permissions"
   FROM ("public"."permissions" "p"
     JOIN "public"."roles" "r" ON (("p"."role_id" = "r"."id")))
  WHERE (("p"."principal_type" = 'user'::"text") AND ("p"."deleted_at" IS NULL) AND ("r"."deleted_at" IS NULL) AND ("p"."object_id" IS NOT NULL))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."users_permissions" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."users_permissions" IS 'Combined materialized view of all user permissions across organizations and workspaces. Automatically refreshed when permissions or roles change.';



CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


COMMENT ON TABLE "public"."workspaces" IS 'Workspaces table for organizing work within organizations';



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "uq_workspace_name_per_org" UNIQUE ("name", "organization_id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_invitations_created_by" ON "public"."invitations" USING "btree" ("created_by");



CREATE INDEX "idx_invitations_status" ON "public"."invitations" USING "btree" ("status");



CREATE INDEX "idx_invitations_user_id" ON "public"."invitations" USING "btree" ("user_id");



CREATE INDEX "idx_permissions_deleted" ON "public"."permissions" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_permissions_object" ON "public"."permissions" USING "btree" ("object_type", "object_id");



CREATE INDEX "idx_permissions_object_type" ON "public"."permissions" USING "btree" ("object_type");



CREATE INDEX "idx_permissions_principal" ON "public"."permissions" USING "btree" ("principal_type", "principal_id", "org_id");



CREATE INDEX "idx_permissions_role" ON "public"."permissions" USING "btree" ("role_id");



CREATE INDEX "idx_roles_deleted" ON "public"."roles" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_roles_name" ON "public"."roles" USING "btree" ("name");



CREATE INDEX "idx_roles_org" ON "public"."roles" USING "btree" ("org_id") WHERE ("org_id" IS NOT NULL);



CREATE INDEX "idx_users_permissions_object" ON "public"."users_permissions" USING "btree" ("object_type", "object_id");



CREATE INDEX "idx_users_permissions_org" ON "public"."users_permissions" USING "btree" ("org_id");



CREATE INDEX "idx_users_permissions_org_user" ON "public"."users_permissions" USING "btree" ("org_id", "user_id");



CREATE UNIQUE INDEX "idx_users_permissions_unique" ON "public"."users_permissions" USING "btree" ("org_id", "object_type", "object_id", "user_id", "role_id");



CREATE INDEX "idx_users_permissions_user" ON "public"."users_permissions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "uq_workspace_name_per_org_case_insensitive" ON "public"."workspaces" USING "btree" ("lower"("name"), "organization_id");



COMMENT ON INDEX "public"."uq_workspace_name_per_org_case_insensitive" IS 'Case-insensitive unique constraint: ensures workspace names are unique within each organization 
  regardless of capitalization.';



CREATE OR REPLACE TRIGGER "trg_assign_ownership_organizations" AFTER INSERT ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."assign_ownership"();



CREATE OR REPLACE TRIGGER "trg_assign_ownership_workspaces" AFTER INSERT ON "public"."workspaces" FOR EACH ROW EXECUTE FUNCTION "public"."assign_ownership"();



CREATE OR REPLACE TRIGGER "trg_delete_organization_permissions" BEFORE DELETE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."delete_organization_permissions"();



CREATE OR REPLACE TRIGGER "trg_delete_workspace_permissions" BEFORE DELETE ON "public"."workspaces" FOR EACH ROW EXECUTE FUNCTION "public"."delete_workspace_permissions"();



CREATE OR REPLACE TRIGGER "trg_refresh_users_permissions" AFTER INSERT OR DELETE OR UPDATE ON "public"."permissions" FOR EACH ROW EXECUTE FUNCTION "public"."refresh_users_permissions_view"();



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can view invitations they created" ON "public"."invitations" FOR SELECT USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can view their own invitations" ON "public"."invitations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "allow_create_org_roles" ON "public"."roles" FOR INSERT TO "authenticated" WITH CHECK ((("org_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."users_permissions" "up"
  WHERE (("up"."object_id" = "roles"."org_id") AND ("up"."object_type" = 'organization'::"text") AND ("up"."user_id" = "auth"."uid"()) AND ("up"."role_name" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



COMMENT ON POLICY "allow_create_org_roles" ON "public"."roles" IS 'Only organization owners and admins can create roles';



CREATE POLICY "allow_create_organizations" ON "public"."organizations" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



COMMENT ON POLICY "allow_create_organizations" ON "public"."organizations" IS 'Authenticated users can create new organizations';



CREATE POLICY "allow_delete_org_roles" ON "public"."roles" FOR DELETE TO "authenticated" USING ((("org_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."users_permissions" "up"
  WHERE (("up"."object_id" = "roles"."org_id") AND ("up"."object_type" = 'organization'::"text") AND ("up"."user_id" = "auth"."uid"()) AND ("up"."role_name" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



COMMENT ON POLICY "allow_delete_org_roles" ON "public"."roles" IS 'Only organization owners and admins can delete roles';



CREATE POLICY "allow_delete_organizations" ON "public"."organizations" FOR DELETE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users_permissions" "up"
  WHERE (("up"."object_id" = "organizations"."id") AND ("up"."object_type" = 'organization'::"text") AND ("up"."user_id" = "auth"."uid"()) AND ("up"."role_name" = 'owner'::"text"))))));



COMMENT ON POLICY "allow_delete_organizations" ON "public"."organizations" IS 'Only owners can delete organizations';



CREATE POLICY "allow_delete_owner_organizations" ON "public"."organizations" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users_permissions" "up"
  WHERE (("up"."object_id" = "organizations"."id") AND ("up"."object_type" = 'organization'::"text") AND ("up"."user_id" = "auth"."uid"()) AND ("up"."role_name" = 'owner'::"text")))));



COMMENT ON POLICY "allow_delete_owner_organizations" ON "public"."organizations" IS 'Only organization owners can delete organizations';



CREATE POLICY "allow_insert_organizations" ON "public"."organizations" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



COMMENT ON POLICY "allow_insert_organizations" ON "public"."organizations" IS 'Any authenticated user can create a new organization';



CREATE POLICY "allow_select_member_organizations" ON "public"."organizations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users_permissions" "up"
  WHERE (("up"."object_id" = "organizations"."id") AND ("up"."object_type" = 'organization'::"text") AND ("up"."user_id" = "auth"."uid"())))));



COMMENT ON POLICY "allow_select_member_organizations" ON "public"."organizations" IS 'Users can view organizations they are members of';



CREATE POLICY "allow_update_member_organizations" ON "public"."organizations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users_permissions" "up"
  WHERE (("up"."object_id" = "organizations"."id") AND ("up"."object_type" = 'organization'::"text") AND ("up"."user_id" = "auth"."uid"()) AND ("up"."role_name" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users_permissions" "up"
  WHERE (("up"."object_id" = "organizations"."id") AND ("up"."object_type" = 'organization'::"text") AND ("up"."user_id" = "auth"."uid"()) AND ("up"."role_name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



COMMENT ON POLICY "allow_update_member_organizations" ON "public"."organizations" IS 'Only organization owners and admins can update organization details';



CREATE POLICY "allow_update_org_roles" ON "public"."roles" FOR UPDATE TO "authenticated" USING ((("org_id" IS NOT NULL) AND ("deleted_at" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."users_permissions" "up"
  WHERE (("up"."object_id" = "roles"."org_id") AND ("up"."object_type" = 'organization'::"text") AND ("up"."user_id" = "auth"."uid"()) AND ("up"."role_name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))) WITH CHECK ((("org_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."users_permissions" "up"
  WHERE (("up"."object_id" = "roles"."org_id") AND ("up"."object_type" = 'organization'::"text") AND ("up"."user_id" = "auth"."uid"()) AND ("up"."role_name" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



COMMENT ON POLICY "allow_update_org_roles" ON "public"."roles" IS 'Only organization owners and admins can update roles';



CREATE POLICY "allow_update_organizations" ON "public"."organizations" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users_permissions" "up"
  WHERE (("up"."object_id" = "organizations"."id") AND ("up"."object_type" = 'organization'::"text") AND ("up"."user_id" = "auth"."uid"()) AND ("up"."role_name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))) WITH CHECK ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users_permissions" "up"
  WHERE (("up"."object_id" = "organizations"."id") AND ("up"."object_type" = 'organization'::"text") AND ("up"."user_id" = "auth"."uid"()) AND ("up"."role_name" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



COMMENT ON POLICY "allow_update_organizations" ON "public"."organizations" IS 'Owners and admins can update organization details';



CREATE POLICY "allow_view_org_roles" ON "public"."roles" FOR SELECT TO "authenticated" USING ((("org_id" IS NOT NULL) AND ("deleted_at" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."users_permissions" "up"
  WHERE (("up"."object_id" = "roles"."org_id") AND ("up"."object_type" = 'organization'::"text") AND ("up"."user_id" = "auth"."uid"()))))));



COMMENT ON POLICY "allow_view_org_roles" ON "public"."roles" IS 'Users can view roles in organizations they belong to';



CREATE POLICY "allow_view_organizations" ON "public"."organizations" FOR SELECT TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users_permissions" "up"
  WHERE (("up"."object_id" = "organizations"."id") AND ("up"."object_type" = 'organization'::"text") AND ("up"."user_id" = "auth"."uid"()))))));



COMMENT ON POLICY "allow_view_organizations" ON "public"."organizations" IS 'Users can view organizations they created or are members of';



CREATE POLICY "allow_view_system_roles" ON "public"."roles" FOR SELECT TO "authenticated" USING ((("org_id" IS NULL) AND ("deleted_at" IS NULL)));



COMMENT ON POLICY "allow_view_system_roles" ON "public"."roles" IS 'All authenticated users can view system-wide roles (org_id IS NULL)';



ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."assign_owner_role"("object_id_param" "uuid", "user_id_param" "uuid", "object_type_param" "text", "org_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_owner_role"("object_id_param" "uuid", "user_id_param" "uuid", "object_type_param" "text", "org_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_owner_role"("object_id_param" "uuid", "user_id_param" "uuid", "object_type_param" "text", "org_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_ownership"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_ownership"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_ownership"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_organization_permissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_organization_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_organization_permissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_workspace_permissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_workspace_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_workspace_permissions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_by_email"("user_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_by_email"("user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_users_permissions_view"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_users_permissions_view"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_users_permissions_view"() TO "service_role";


















GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."permissions" TO "anon";
GRANT ALL ON TABLE "public"."permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."permissions" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."users_permissions" TO "anon";
GRANT ALL ON TABLE "public"."users_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."users_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


