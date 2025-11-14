# EPIC: Unified Permissions System Implementation

**Epic Goal**: Implement a centralized, extensible role-based access control (RBAC) system that supports organization-level and workspace-level permissions with type-specific granularity.

**Business Value**: Enable team collaboration, fine-grained access control, and support future workspace entities (tasks, epics, workflows, etc.) without schema changes.

**Success Criteria**:
- ✅ All permissions stored in central `permission` table
- ✅ Single generic `principal_role_assignment` table (no entity-specific role tables)
- ✅ RLS policies enforced at database level
- ✅ Can add new workspace tables without modifying permission infrastructure
- ✅ Support type-specific permissions (e.g., "edit tasks but not epics")

---

## Task 1: Core RBAC Database Schema & Infrastructure

**Objective**: Create foundational tables, enums, and constraints for the unified permission system.

### Deliverables

#### 1.1 Core Types & Enums
```sql
-- Principal types (who can have roles)
create type principal_kind as enum ('user', 'team');

-- Resource types (what can be protected)
create type resource_kind as enum (
  'organization',
  'workspace',
  'object_instance',
  'object_type',
  'workflow'
  -- EXTENSIBLE: Add new types here as you add workspace entities
);
```

#### 1.2 Organization Membership
```sql
create table organization_member (
  org_id uuid not null references organization(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid references auth.users(id),
  joined_at timestamptz default now(),
  primary key (org_id, user_id)
);

create index idx_org_member_user on organization_member(user_id);
create index idx_org_member_org on organization_member(org_id);
```

#### 1.3 Teams
```sql
create table team (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organization(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, name)
);

create table team_member (
  team_id uuid not null references team(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id),
  joined_at timestamptz default now(),
  primary key (team_id, user_id)
);

create index idx_team_member_user on team_member(user_id);
create index idx_team_org on team(org_id);
```

#### 1.4 Roles (Central Registry)
```sql
create table role (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,  -- 'org_owner', 'workspace_editor', etc.
  description text,
  created_at timestamptz default now()
);

create index idx_role_name on role(name);
```

#### 1.5 Role Assignments (Unified)
```sql
create table principal_role_assignment (
  id uuid primary key default gen_random_uuid(),

  -- Who has the role
  principal_kind principal_kind not null,
  principal_id uuid not null,

  -- Where they have it
  org_id uuid not null references organization(id) on delete cascade,
  workspace_id uuid references workspace(id) on delete cascade,

  -- What role they have
  role_id uuid not null references role(id) on delete cascade,

  -- Audit trail
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz default now(),

  -- Ensure unique assignments
  unique (principal_kind, principal_id, org_id, coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), role_id)
);

-- Performance indexes
create index idx_pra_lookup
  on principal_role_assignment(principal_kind, principal_id, org_id);

create index idx_pra_workspace
  on principal_role_assignment(workspace_id)
  where workspace_id is not null;

create index idx_pra_role
  on principal_role_assignment(role_id);
```

#### 1.6 Permissions (Central Registry)
```sql
create table permission (
  id uuid primary key default gen_random_uuid(),

  -- Which role has this permission
  role_id uuid not null references role(id) on delete cascade,

  -- What resource type it applies to
  resource resource_kind not null,

  -- What action is allowed
  action text not null,  -- 'read', 'create', 'update', 'delete', 'manage_members', etc.

  -- Scoping flags
  apply_org_wide boolean default false,      -- Applies to all workspaces in org
  apply_workspace_wide boolean default false, -- Applies to all instances in workspace

  -- For object-specific permissions
  object_type_id uuid,  -- references object_type(id), added in Task 3

  created_at timestamptz default now(),

  -- Prevent duplicate permissions
  unique (role_id, resource, action, coalesce(object_type_id, '00000000-0000-0000-0000-000000000000'::uuid))
);

-- Constraint: object_type_id only for object resources
alter table permission
  add constraint check_object_type_id_usage
  check (
    (resource in ('object_instance', 'object_type') and object_type_id is not null)
    or (resource not in ('object_instance', 'object_type') and object_type_id is null)
  );

-- Performance indexes
create index idx_permission_role_resource
  on permission(role_id, resource, action);

create index idx_permission_object_type
  on permission(object_type_id)
  where object_type_id is not null;
```

### Acceptance Criteria
- ✅ All tables created with proper foreign keys and constraints
- ✅ All indexes created for performance
- ✅ `org_id` is always NOT NULL (all roles exist within an org context)
- ✅ No nullable columns in primary keys
- ✅ Audit fields (`assigned_by`, `created_at`) present
- ✅ Cascading deletes configured correctly

### Migration File
`supabase/migrations/[timestamp]_create_rbac_infrastructure.sql`

---

## Task 2: Central Permission System & RLS Policies

**Objective**: Implement the `has_permission()` function and apply RLS policies to all tables.

### Deliverables

#### 2.1 Core Permission Check Function
```sql
create or replace function has_permission(
  _resource resource_kind,
  _action text,
  _org_id uuid,
  _workspace_id uuid default null,
  _object_type_id uuid default null
)
returns boolean as $$
begin
  return exists (
    with principals as (
      -- Current user as a 'user' principal
      select 'user'::principal_kind as kind, auth.uid()::uuid as id

      union

      -- All teams the user belongs to
      select 'team'::principal_kind, tm.team_id
      from team_member tm
      where tm.user_id = auth.uid()
    ),
    user_roles as (
      select distinct pra.role_id
      from principals p
      join principal_role_assignment pra
        on pra.principal_kind = p.kind
       and pra.principal_id = p.id
       and pra.org_id = _org_id
       and (
         -- Exact workspace match
         pra.workspace_id = _workspace_id
         or
         -- Org-level role (applies to all workspaces)
         (_workspace_id is not null and pra.workspace_id is null)
         or
         -- Org-level check (no specific workspace)
         (_workspace_id is null and pra.workspace_id is null)
       )
    )
    select 1
    from user_roles ur
    join permission perm
      on perm.role_id = ur.role_id
     and perm.resource = _resource
     and perm.action = _action
     and (
       -- Org-wide permissions
       (_workspace_id is not null and perm.apply_org_wide = true)
       or
       -- Workspace-wide permissions
       (_workspace_id is not null and perm.apply_workspace_wide = true)
       or
       -- Object-type specific permissions
       (perm.object_type_id is null or perm.object_type_id = _object_type_id)
       or
       -- Org-level check (no workspace context)
       (_workspace_id is null and perm.apply_org_wide = false)
     )
  );
end;
$$ language plpgsql security definer stable;
```

#### 2.2 Helper Function: Check Org Membership
```sql
create or replace function is_org_member(_org_id uuid)
returns boolean as $$
begin
  return exists (
    select 1
    from organization_member
    where org_id = _org_id
      and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer stable;
```

#### 2.3 RLS Policies for Organization
```sql
-- Enable RLS
alter table organization enable row level security;

-- Read: member of org OR has read permission
create policy "Users can read orgs they belong to"
  on organization for select
  using (
    is_org_member(id)
    or
    has_permission('organization'::resource_kind, 'read', id)
  );

-- Update: must have update permission
create policy "Users can update orgs with permission"
  on organization for update
  using (
    has_permission('organization'::resource_kind, 'update', id)
  );

-- Delete: must have delete permission
create policy "Users can delete orgs with permission"
  on organization for delete
  using (
    has_permission('organization'::resource_kind, 'delete', id)
  );
```

#### 2.4 RLS Policies for Workspace
```sql
alter table workspace enable row level security;

-- Read: must have workspace read permission
create policy "Users can read workspaces with permission"
  on workspace for select
  using (
    has_permission('workspace'::resource_kind, 'read', org_id, id)
  );

-- Insert: must have workspace create permission in the org
create policy "Users can create workspaces with permission"
  on workspace for insert
  with check (
    has_permission('workspace'::resource_kind, 'create', org_id)
  );

-- Update: must have workspace update permission
create policy "Users can update workspaces with permission"
  on workspace for update
  using (
    has_permission('workspace'::resource_kind, 'update', org_id, id)
  );

-- Delete: must have workspace delete permission
create policy "Users can delete workspaces with permission"
  on workspace for delete
  using (
    has_permission('workspace'::resource_kind, 'delete', org_id, id)
  );
```

#### 2.5 RLS Policies for Team Management
```sql
alter table team enable row level security;

-- Read: members of the org can see teams
create policy "Org members can read teams"
  on team for select
  using (is_org_member(org_id));

-- Insert/Update/Delete: requires manage_teams permission
create policy "Users can manage teams with permission"
  on team for all
  using (
    has_permission('organization'::resource_kind, 'manage_teams', org_id)
  );

alter table team_member enable row level security;

-- Read: can see team members if you can see the team
create policy "Users can read team members"
  on team_member for select
  using (
    exists (
      select 1 from team t
      where t.id = team_id
        and is_org_member(t.org_id)
    )
  );

-- Manage: requires manage_teams permission
create policy "Users can manage team members with permission"
  on team_member for all
  using (
    exists (
      select 1 from team t
      where t.id = team_id
        and has_permission('organization'::resource_kind, 'manage_teams', t.org_id)
    )
  );
```

#### 2.6 RLS Policies for Principal Role Assignment
```sql
alter table principal_role_assignment enable row level security;

-- Read: org members can see role assignments
create policy "Org members can read role assignments"
  on principal_role_assignment for select
  using (is_org_member(org_id));

-- Manage: requires manage_roles permission
create policy "Users can manage roles with permission"
  on principal_role_assignment for all
  using (
    has_permission('organization'::resource_kind, 'manage_roles', org_id)
  );
```

### Acceptance Criteria
- ✅ `has_permission()` function handles org-level and workspace-level roles correctly
- ✅ Org-level roles inherit down to workspaces
- ✅ RLS policies applied to all existing tables
- ✅ Functions marked as `security definer stable` for performance
- ✅ All policies tested with different user scenarios

### Migration File
`supabase/migrations/[timestamp]_create_permission_functions_and_rls.sql`

---

## Task 3: Seed Roles, Permissions & Extensibility Pattern

**Objective**: Create initial roles and permissions, demonstrate extensibility by adding an example workspace entity (object_type + object).

### Deliverables

#### 3.1 Seed Roles
```sql
-- Organization-level roles
insert into role (id, name, description) values
  ('10000000-0000-0000-0000-000000000001', 'org_owner', 'Full control over organization'),
  ('10000000-0000-0000-0000-000000000002', 'org_admin', 'Manage members and settings'),
  ('10000000-0000-0000-0000-000000000003', 'org_member', 'Basic organization member');

-- Workspace-level roles
insert into role (id, name, description) values
  ('20000000-0000-0000-0000-000000000001', 'workspace_owner', 'Full control over workspace'),
  ('20000000-0000-0000-0000-000000000002', 'workspace_editor', 'Edit all content in workspace'),
  ('20000000-0000-0000-0000-000000000003', 'workspace_viewer', 'View all content in workspace');

-- Type-specific roles (example for task management)
insert into role (id, name, description) values
  ('30000000-0000-0000-0000-000000000001', 'task_editor', 'Create and edit tasks only'),
  ('30000000-0000-0000-0000-000000000002', 'project_editor', 'Create and edit projects only');
```

#### 3.2 Seed Permissions for Org Owner
```sql
-- Org owner can do everything at org level
insert into permission (role_id, resource, action, apply_org_wide) values
  ('10000000-0000-0000-0000-000000000001', 'organization', 'read', true),
  ('10000000-0000-0000-0000-000000000001', 'organization', 'update', true),
  ('10000000-0000-0000-0000-000000000001', 'organization', 'delete', true),
  ('10000000-0000-0000-0000-000000000001', 'organization', 'manage_members', true),
  ('10000000-0000-0000-0000-000000000001', 'organization', 'manage_teams', true),
  ('10000000-0000-0000-0000-000000000001', 'organization', 'manage_roles', true),
  ('10000000-0000-0000-0000-000000000001', 'workspace', 'read', true),
  ('10000000-0000-0000-0000-000000000001', 'workspace', 'create', true),
  ('10000000-0000-0000-0000-000000000001', 'workspace', 'update', true),
  ('10000000-0000-0000-0000-000000000001', 'workspace', 'delete', true);
```

#### 3.3 Seed Permissions for Org Member
```sql
-- Org member can read org and workspaces they're assigned to
insert into permission (role_id, resource, action) values
  ('10000000-0000-0000-0000-000000000003', 'organization', 'read');
```

#### 3.4 Seed Permissions for Workspace Owner
```sql
-- Workspace owner can do everything in their workspace
insert into permission (role_id, resource, action, apply_workspace_wide) values
  ('20000000-0000-0000-0000-000000000001', 'workspace', 'read', false),
  ('20000000-0000-0000-0000-000000000001', 'workspace', 'update', false),
  ('20000000-0000-0000-0000-000000000001', 'workspace', 'delete', false),
  ('20000000-0000-0000-0000-000000000001', 'object_instance', 'read', true),
  ('20000000-0000-0000-0000-000000000001', 'object_instance', 'create', true),
  ('20000000-0000-0000-0000-000000000001', 'object_instance', 'update', true),
  ('20000000-0000-0000-0000-000000000001', 'object_instance', 'delete', true),
  ('20000000-0000-0000-0000-000000000001', 'object_type', 'read', true),
  ('20000000-0000-0000-0000-000000000001', 'object_type', 'create', true);
```

#### 3.5 Seed Permissions for Workspace Viewer
```sql
-- Workspace viewer can only read
insert into permission (role_id, resource, action, apply_workspace_wide) values
  ('20000000-0000-0000-0000-000000000003', 'workspace', 'read', false),
  ('20000000-0000-0000-0000-000000000003', 'object_instance', 'read', true),
  ('20000000-0000-0000-0000-000000000003', 'object_type', 'read', true);
```

#### 3.6 Example: Extensible Object System
**Demonstrates how to add NEW entities without changing permission infrastructure**

```sql
-- Step 1: Create object_type table (defines what types of objects exist)
create table object_type (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  name text not null,  -- 'task', 'epic', 'project', etc.
  schema jsonb not null,  -- JSON schema for validation
  created_by uuid not null references auth.users(id),
  created_at timestamptz default now(),
  unique(workspace_id, name)
);

-- Step 2: Create object table (actual instances)
create table object (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  object_type_id uuid not null references object_type(id) on delete cascade,
  data jsonb not null,
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_object_workspace on object(workspace_id);
create index idx_object_type on object(object_type_id);
create index idx_object_data on object using gin(data);

-- Step 3: Apply RLS using existing permission system
alter table object_type enable row level security;

create policy "Users can read object types with permission"
  on object_type for select
  using (
    has_permission(
      'object_type'::resource_kind,
      'read',
      (select org_id from workspace where id = workspace_id),
      workspace_id
    )
  );

create policy "Users can create object types with permission"
  on object_type for insert
  with check (
    has_permission(
      'object_type'::resource_kind,
      'create',
      (select org_id from workspace where id = workspace_id),
      workspace_id
    )
  );

alter table object enable row level security;

-- Read objects: need permission for that specific type
create policy "Users can read objects with permission"
  on object for select
  using (
    has_permission(
      'object_instance'::resource_kind,
      'read',
      (select org_id from workspace where id = workspace_id),
      workspace_id,
      object_type_id
    )
  );

-- Create objects: need permission for that specific type
create policy "Users can create objects with permission"
  on object for insert
  with check (
    has_permission(
      'object_instance'::resource_kind,
      'create',
      (select org_id from workspace where id = workspace_id),
      workspace_id,
      object_type_id
    )
  );

-- Update objects: need permission for that specific type
create policy "Users can update objects with permission"
  on object for update
  using (
    has_permission(
      'object_instance'::resource_kind,
      'update',
      (select org_id from workspace where id = workspace_id),
      workspace_id,
      object_type_id
    )
  );

-- Delete objects: need permission for that specific type
create policy "Users can delete objects with permission"
  on object for delete
  using (
    has_permission(
      'object_instance'::resource_kind,
      'delete',
      (select org_id from workspace where id = workspace_id),
      workspace_id,
      object_type_id
    )
  );
```

#### 3.7 Example: Type-Specific Permissions (Task Editor)
```sql
-- First, create a "task" object type in your workspace
insert into object_type (id, workspace_id, name, schema) values
  ('40000000-0000-0000-0000-000000000001', '<your_workspace_id>', 'task', '{
    "type": "object",
    "properties": {
      "title": {"type": "string"},
      "status": {"type": "string"},
      "assignee": {"type": "string"}
    }
  }'::jsonb);

-- Then, give the task_editor role permissions ONLY for tasks
insert into permission (role_id, resource, action, object_type_id) values
  ('30000000-0000-0000-0000-000000000001', 'object_instance', 'read', '40000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000001', 'object_instance', 'create', '40000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000001', 'object_instance', 'update', '40000000-0000-0000-0000-000000000001');

-- Now anyone with 'task_editor' role can ONLY edit tasks, not epics or projects!
```

#### 3.8 Extensibility Documentation
```markdown
# How to Add New Workspace Entities

## Pattern: Add ANY new table without touching permissions infrastructure

1. **Create your new table** (e.g., `workflow`, `document`, `comment`, etc.)
   - Must have `workspace_id` foreign key
   - Must have `org_id` or derive it from workspace

2. **Add to resource_kind enum** (if it's a new resource type)
   ```sql
   alter type resource_kind add value 'your_new_resource';
   ```

3. **Apply RLS using existing has_permission()**
   ```sql
   create policy "Users can read <entity> with permission"
     on <entity> for select
     using (
       has_permission(
         'your_new_resource'::resource_kind,
         'read',
         (select org_id from workspace where id = workspace_id),
         workspace_id
       )
     );
   ```

4. **Create permissions for existing roles**
   ```sql
   insert into permission (role_id, resource, action, apply_workspace_wide)
   select role_id, 'your_new_resource', 'read', true
   from role where name = 'workspace_owner';
   ```

5. **Done!** No changes to permission system needed.

## Examples of Future Extensions

### Add Workflow Engine
```sql
create table workflow (
  id uuid primary key,
  workspace_id uuid not null references workspace(id),
  name text,
  definition jsonb
);

-- Add to enum
alter type resource_kind add value 'workflow';

-- Apply RLS
create policy "..." on workflow for select using (
  has_permission('workflow'::resource_kind, 'read', ...)
);
```

### Add Document System
```sql
create table document (
  id uuid primary key,
  workspace_id uuid not null references workspace(id),
  content text
);

alter type resource_kind add value 'document';
-- Apply same RLS pattern
```

### Add Comments to Objects
```sql
create table object_comment (
  id uuid primary key,
  object_id uuid not null references object(id),
  -- workspace_id derived from object
  content text
);

-- Use same RLS pattern, inherit from object permissions
```

NO changes to `permission`, `principal_role_assignment`, or `has_permission()` needed!
```

### Acceptance Criteria
- ✅ At least 6 roles created (org_owner, org_member, workspace_owner, workspace_editor, workspace_viewer, + 1 type-specific)
- ✅ Permissions seeded for each role
- ✅ `object_type` and `object` tables created as extensibility example
- ✅ RLS policies applied to object tables
- ✅ Type-specific permissions demonstrated (e.g., task_editor)
- ✅ Documentation created showing how to add future entities

### Migration Files
- `supabase/migrations/[timestamp]_seed_roles_and_permissions.sql`
- `supabase/migrations/[timestamp]_create_object_system_example.sql`

---

## Task 4: Application Integration & Migration

**Objective**: Update existing Server Actions, migrate current users to new system, create member management UI.

### Deliverables

#### 4.1 TypeScript Types
```typescript
// lib/types/rbac.ts

export type PrincipalKind = 'user' | 'team';

export type ResourceKind =
  | 'organization'
  | 'workspace'
  | 'object_instance'
  | 'object_type'
  | 'workflow';

export type ActionType =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'manage_members'
  | 'manage_teams'
  | 'manage_roles';

export interface Role {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Permission {
  id: string;
  role_id: string;
  resource: ResourceKind;
  action: ActionType;
  apply_org_wide: boolean;
  apply_workspace_wide: boolean;
  object_type_id: string | null;
}

export interface PrincipalRoleAssignment {
  id: string;
  principal_kind: PrincipalKind;
  principal_id: string;
  org_id: string;
  workspace_id: string | null;
  role_id: string;
  assigned_by: string | null;
  assigned_at: string;
}

export interface Team {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface OrganizationMember {
  org_id: string;
  user_id: string;
  invited_by: string | null;
  joined_at: string;
}
```

#### 4.2 Permission Check Utilities
```typescript
// lib/utils/permissions.ts

import { createClient } from '@/lib/supabase/server';

export async function hasPermission(
  resource: ResourceKind,
  action: ActionType,
  orgId: string,
  workspaceId?: string,
  objectTypeId?: string
): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('has_permission', {
    _resource: resource,
    _action: action,
    _org_id: orgId,
    _workspace_id: workspaceId || null,
    _object_type_id: objectTypeId || null
  });

  if (error) {
    console.error('Permission check failed:', error);
    return false;
  }

  return data === true;
}

export async function requirePermission(
  resource: ResourceKind,
  action: ActionType,
  orgId: string,
  workspaceId?: string,
  objectTypeId?: string
): Promise<void> {
  const allowed = await hasPermission(resource, action, orgId, workspaceId, objectTypeId);

  if (!allowed) {
    throw new Error(`Permission denied: ${action} on ${resource}`);
  }
}

export async function isOrgMember(orgId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('is_org_member', {
    _org_id: orgId
  });

  return data === true;
}
```

#### 4.3 Update Organization Actions
```typescript
// lib/actions/organization-actions.ts

import { requirePermission } from '@/lib/utils/permissions';

export async function updateOrganization(orgId: string, updates: Partial<Organization>) {
  // OLD: if (data.created_by !== userId) { throw new Error('Unauthorized'); }

  // NEW: Check permission via central system
  await requirePermission('organization', 'update', orgId);

  const supabase = await createClient();

  // RLS will also enforce this at database level
  const { data, error } = await supabase
    .from('organization')
    .update(updates)
    .eq('id', orgId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteOrganization(orgId: string) {
  await requirePermission('organization', 'delete', orgId);

  const supabase = await createClient();
  const { error } = await supabase
    .from('organization')
    .delete()
    .eq('id', orgId);

  if (error) throw error;
}
```

#### 4.4 Update Workspace Actions
```typescript
// lib/actions/workspace-actions.ts

export async function createWorkspace(orgId: string, name: string) {
  await requirePermission('workspace', 'create', orgId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('workspace')
    .insert({
      org_id: orgId,
      name,
      created_by: user!.id
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateWorkspace(
  workspaceId: string,
  updates: Partial<Workspace>
) {
  const supabase = await createClient();

  // Get org_id for permission check
  const { data: workspace } = await supabase
    .from('workspace')
    .select('org_id')
    .eq('id', workspaceId)
    .single();

  if (!workspace) throw new Error('Workspace not found');

  await requirePermission('workspace', 'update', workspace.org_id, workspaceId);

  const { data, error } = await supabase
    .from('workspace')
    .update(updates)
    .eq('id', workspaceId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

#### 4.5 Data Migration Script
```typescript
// scripts/migrate-to-rbac.ts

/**
 * Migrates existing users to the new RBAC system
 * - Makes all current org creators -> org_owner
 * - Makes all current workspace creators -> workspace_owner
 * - Adds all users to their orgs as organization_member
 */

import { createClient } from '@supabase/supabase-js';

async function migrate() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role for migration
  );

  // 1. Get org_owner role id
  const { data: orgOwnerRole } = await supabase
    .from('role')
    .select('id')
    .eq('name', 'org_owner')
    .single();

  // 2. Get workspace_owner role id
  const { data: workspaceOwnerRole } = await supabase
    .from('role')
    .select('id')
    .eq('name', 'workspace_owner')
    .single();

  // 3. Get all organizations and their creators
  const { data: orgs } = await supabase
    .from('organization')
    .select('id, created_by');

  // 4. For each org, add creator as org_owner and org_member
  for (const org of orgs || []) {
    // Add to organization_member
    await supabase
      .from('organization_member')
      .insert({
        org_id: org.id,
        user_id: org.created_by
      })
      .onConflict('org_id,user_id')
      .ignore();

    // Assign org_owner role
    await supabase
      .from('principal_role_assignment')
      .insert({
        principal_kind: 'user',
        principal_id: org.created_by,
        org_id: org.id,
        workspace_id: null,
        role_id: orgOwnerRole!.id,
        assigned_by: org.created_by
      });
  }

  // 5. Get all workspaces and their creators
  const { data: workspaces } = await supabase
    .from('workspace')
    .select('id, org_id, created_by');

  // 6. For each workspace, add creator as workspace_owner
  for (const ws of workspaces || []) {
    await supabase
      .from('principal_role_assignment')
      .insert({
        principal_kind: 'user',
        principal_id: ws.created_by,
        org_id: ws.org_id,
        workspace_id: ws.id,
        role_id: workspaceOwnerRole!.id,
        assigned_by: ws.created_by
      });
  }

  console.log('Migration complete!');
}

migrate().catch(console.error);
```

#### 4.6 Member Management UI Components
```typescript
// components/member-manager.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { inviteOrgMember, removeOrgMember } from '@/lib/actions/member-actions';

interface MemberManagerProps {
  orgId: string;
  members: OrganizationMember[];
}

export function MemberManager({ orgId, members }: MemberManagerProps) {
  const [email, setEmail] = useState('');

  async function handleInvite() {
    await inviteOrgMember(orgId, email);
    setEmail('');
  }

  async function handleRemove(userId: string) {
    await removeOrgMember(orgId, userId);
  }

  return (
    <div>
      <h3>Organization Members</h3>

      <div className="flex gap-2 mb-4">
        <Input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button onClick={handleInvite}>Invite</Button>
      </div>

      <div>
        {members.map((member) => (
          <div key={member.user_id} className="flex justify-between">
            <span>{member.user_id}</span>
            <Button variant="destructive" onClick={() => handleRemove(member.user_id)}>
              Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

```typescript
// components/role-manager.tsx

'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { assignRole, removeRole } from '@/lib/actions/role-actions';

interface RoleManagerProps {
  orgId: string;
  workspaceId?: string;
  userId: string;
  currentRoles: string[];
  availableRoles: Role[];
}

export function RoleManager({
  orgId,
  workspaceId,
  userId,
  currentRoles,
  availableRoles
}: RoleManagerProps) {
  async function handleAssignRole(roleId: string) {
    await assignRole({
      principalKind: 'user',
      principalId: userId,
      orgId,
      workspaceId: workspaceId || null,
      roleId
    });
  }

  return (
    <div>
      <h4>Roles</h4>
      <Select onValueChange={handleAssignRole}>
        <SelectTrigger>
          <SelectValue placeholder="Assign role" />
        </SelectTrigger>
        <SelectContent>
          {availableRoles.map((role) => (
            <SelectItem key={role.id} value={role.id}>
              {role.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="mt-2">
        {currentRoles.map((roleId) => {
          const role = availableRoles.find((r) => r.id === roleId);
          return (
            <div key={roleId}>
              {role?.name}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

#### 4.7 New Actions for Member & Role Management
```typescript
// lib/actions/member-actions.ts

export async function inviteOrgMember(orgId: string, email: string) {
  await requirePermission('organization', 'manage_members', orgId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Invite user via Supabase Auth (sends email)
  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    email,
    {
      data: { org_id: orgId }
    }
  );

  if (inviteError) throw inviteError;

  // 2. Add to organization_member
  const { error } = await supabase
    .from('organization_member')
    .insert({
      org_id: orgId,
      user_id: inviteData.user.id,
      invited_by: user!.id
    });

  if (error) throw error;

  // 3. Assign default org_member role
  const { data: memberRole } = await supabase
    .from('role')
    .select('id')
    .eq('name', 'org_member')
    .single();

  await supabase
    .from('principal_role_assignment')
    .insert({
      principal_kind: 'user',
      principal_id: inviteData.user.id,
      org_id: orgId,
      workspace_id: null,
      role_id: memberRole!.id,
      assigned_by: user!.id
    });
}

export async function removeOrgMember(orgId: string, userId: string) {
  await requirePermission('organization', 'manage_members', orgId);

  const supabase = await createClient();

  // Cascade will handle role assignments
  const { error } = await supabase
    .from('organization_member')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', userId);

  if (error) throw error;
}
```

```typescript
// lib/actions/role-actions.ts

export async function assignRole(assignment: {
  principalKind: PrincipalKind;
  principalId: string;
  orgId: string;
  workspaceId: string | null;
  roleId: string;
}) {
  await requirePermission('organization', 'manage_roles', assignment.orgId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('principal_role_assignment')
    .insert({
      ...assignment,
      assigned_by: user!.id
    });

  if (error) throw error;
}

export async function removeRole(assignmentId: string, orgId: string) {
  await requirePermission('organization', 'manage_roles', orgId);

  const supabase = await createClient();

  const { error } = await supabase
    .from('principal_role_assignment')
    .delete()
    .eq('id', assignmentId);

  if (error) throw error;
}
```

#### 4.8 Update Settings Page
```typescript
// app/(app)/settings/page.tsx

import { MemberManager } from '@/components/member-manager';
import { OrganizationManager } from '@/components/organization-manager';
import { hasPermission } from '@/lib/utils/permissions';

export default async function SettingsPage() {
  const supabase = await createClient();

  // Get user's orgs
  const { data: memberships } = await supabase
    .from('organization_member')
    .select('org_id, organization(*)')
    .eq('user_id', (await supabase.auth.getUser()).data.user!.id);

  const canManageMembers = await hasPermission(
    'organization',
    'manage_members',
    memberships?.[0]?.org_id
  );

  return (
    <div>
      <OrganizationManager />

      {canManageMembers && memberships && (
        <MemberManager
          orgId={memberships[0].org_id}
          members={/* fetch members */}
        />
      )}
    </div>
  );
}
```

### Acceptance Criteria
- ✅ All TypeScript types defined for RBAC system
- ✅ Permission utilities created and exported
- ✅ Organization and workspace actions updated to use `requirePermission()`
- ✅ Old creator checks removed (RLS handles this now)
- ✅ Migration script successfully runs and assigns roles to existing users
- ✅ Member management UI created and functional
- ✅ Role assignment UI created and functional
- ✅ Settings page updated to show member/role management
- ✅ All existing functionality still works with new system

### Files to Update
- `lib/types/rbac.ts` (new)
- `lib/utils/permissions.ts` (new)
- `lib/actions/organization-actions.ts` (update)
- `lib/actions/workspace-actions.ts` (update)
- `lib/actions/member-actions.ts` (new)
- `lib/actions/role-actions.ts` (new)
- `components/member-manager.tsx` (new)
- `components/role-manager.tsx` (new)
- `app/(app)/settings/page.tsx` (update)
- `scripts/migrate-to-rbac.ts` (new)

---

## Epic Success Criteria

- ✅ **Zero** entity-specific role tables (`workspace_team_role` does not exist)
- ✅ **One** central `permission` table
- ✅ **One** generic `principal_role_assignment` table
- ✅ RLS enforced on all tables
- ✅ Added new workspace entity (object/object_type) without modifying permission infrastructure
- ✅ Type-specific permissions working (can edit tasks but not projects)
- ✅ All existing users migrated to new system
- ✅ Member and role management UI functional
- ✅ Documentation exists for adding future entities

---

## Testing Checklist

### Unit Tests
- [ ] `has_permission()` returns true for valid permissions
- [ ] `has_permission()` returns false for invalid permissions
- [ ] Org-level roles inherit to workspaces
- [ ] Type-specific permissions work correctly
- [ ] RLS policies block unauthorized access

### Integration Tests
- [ ] User with `workspace_viewer` cannot edit workspace
- [ ] User with `task_editor` can edit tasks but not projects
- [ ] Org owner can access all workspaces
- [ ] Team member inherits team's roles
- [ ] Removing user from org revokes all their access

### Migration Tests
- [ ] Existing org creators become org_owners
- [ ] Existing workspace creators become workspace_owners
- [ ] No users lose access after migration
- [ ] Old permission checks are fully removed

---

## Performance Considerations

1. **Index all foreign keys** - Done in Task 1
2. **Cache team memberships** - Consider implementing session-level caching
3. **Materialize complex permissions** - For high-volume tables, consider permission cache table
4. **Monitor `has_permission()` execution time** - Add logging/monitoring

---

## Extensibility Guarantee

**This design guarantees:**

When you add a new entity (e.g., `workflow`, `document`, `comment`):

1. ✅ **No changes** to `permission` table schema
2. ✅ **No changes** to `principal_role_assignment` table schema
3. ✅ **No changes** to `has_permission()` function
4. ✅ **Only need to:**
   - Add value to `resource_kind` enum (if new resource type)
   - Create new table with `workspace_id`
   - Apply RLS using existing `has_permission()`
   - Insert permissions for existing roles

**Example: Adding a workflow system takes 30 minutes, not 3 hours.**

---

## Questions & Decisions

### Q: Should we cache permissions in Redis?
**Decision**: Start without caching. PostgreSQL with proper indexes should handle 100k+ permission checks/sec. Add caching only if profiling shows it's needed.

### Q: How do we handle workspace-level member management?
**Decision**: Phase 2. For now, org members with workspace roles is sufficient. Can add `workspace_member` table later if needed.

### Q: Should object-level permissions be supported (e.g., "User X can edit Task 123")?
**Decision**: Not in v1. Current design supports type-level ("all tasks") and workspace-level. Object-level ACLs can be added via `object_permission` table in future without changing core system.

### Q: How do we handle permission inheritance beyond org → workspace?
**Decision**: Current system supports 2 levels (org, workspace). For more complex hierarchies (org → division → team → workspace), add `parent_workspace_id` and update `has_permission()` to walk the tree.

---

## Timeline Estimate

- **Task 1**: 6-8 hours (schema design + migration files)
- **Task 2**: 4-6 hours (RLS policies + functions)
- **Task 3**: 4-6 hours (seed data + object system example)
- **Task 4**: 8-10 hours (TypeScript integration + UI + migration)

**Total**: 22-30 hours

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Performance degradation from complex RLS | Index all joins, monitor query plans, add caching if needed |
| Migration fails for existing users | Test on staging, add rollback script, dry-run mode |
| Breaking changes to existing code | Feature flag, gradual rollout per organization |
| Complexity for simple use cases | Provide default roles that "just work" for 80% of cases |

---

## Next Steps After Epic

1. Add workspace-level teams (currently only org-level)
2. Add audit logging for all permission changes
3. Add permission inheritance visualization UI
4. Add bulk role assignment
5. Add custom role creation UI (currently only seed roles)
6. Add object-level permissions (optional)
7. Add webhook/notification system for permission changes
