# Database Cascade Delete Analysis

## Question
What happens if a user is removed from the `auth.users` table? Will all related records in organizations, organization_members, permissions, principal_role_assignments, roles, team_members, teams, and workspaces be removed as well?

---

## Answer: YES - Cascading Deletes Will Occur

When a user is deleted from `auth.users`, **PostgreSQL will automatically cascade delete** all related records due to the `ON DELETE CASCADE` foreign key constraints defined in the migrations.

---

## Detailed Cascade Chain

### 1. **Direct User References with ON DELETE CASCADE**

These tables have direct foreign keys to `auth.users(id)` with `ON DELETE CASCADE`:

#### **organizations table**
```sql
created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
updated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
```
**Result:** Any organization created or last updated by the deleted user will be **deleted**.

#### **workspaces table**
```sql
created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
updated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
```
**Result:** Any workspace created or last updated by the deleted user will be **deleted**.

#### **organization_members table**
```sql
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
updated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
```
**Result:** 
- All membership records for the deleted user will be **deleted**
- Any membership records created/updated by the deleted user will be **deleted**

#### **teams table**
```sql
created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
updated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
```
**Result:** Any team created or last updated by the deleted user will be **deleted**.

#### **team_members table**
```sql
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
updated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
```
**Result:**
- All team membership records for the deleted user will be **deleted**
- Any team membership records created/updated by the deleted user will be **deleted**

#### **principal_role_assignments table**
```sql
created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
updated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
```
**Result:** Any role assignment created or last updated by the deleted user will be **deleted**.

---

### 2. **Secondary Cascade Effects**

Once the direct deletes occur, secondary cascades are triggered:

#### **When organizations are deleted:**
```sql
-- From workspaces table
organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

-- From teams table
org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

-- From principal_role_assignments table
org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
```

**Cascade chain:**
```
User deleted
  ↓
Organizations (created_by/updated_by) deleted
  ↓
  ├─ Workspaces (organization_id) deleted
  │   ├─ Principal role assignments (workspace_id) deleted
  │   └─ Any entities in workspace deleted
  ├─ Teams (org_id) deleted
  │   └─ Team members deleted
  └─ Principal role assignments (org_id) deleted
```

#### **When workspaces are deleted:**
```sql
-- From principal_role_assignments table
workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
```

**Result:** All workspace-level role assignments are **deleted**.

#### **When teams are deleted:**
```sql
-- From team_members table
team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
```

**Result:** All team membership records are **deleted**.

---

## Complete Deletion Scenario

### Example: User "john@example.com" is deleted

**Step 1: Direct cascades from auth.users**
- ❌ All `organization_members` where `user_id = john`
- ❌ All `team_members` where `user_id = john`
- ❌ All `organizations` where `created_by = john` OR `updated_by = john`
- ❌ All `workspaces` where `created_by = john` OR `updated_by = john`
- ❌ All `teams` where `created_by = john` OR `updated_by = john`
- ❌ All `principal_role_assignments` where `created_by = john` OR `updated_by = john`

**Step 2: Secondary cascades**
- ❌ All `workspaces` in organizations that were deleted (via `organization_id` FK)
- ❌ All `teams` in organizations that were deleted (via `org_id` FK)
- ❌ All `team_members` in teams that were deleted (via `team_id` FK)
- ❌ All `principal_role_assignments` for deleted organizations/workspaces

**Step 3: Tertiary cascades**
- ❌ All `principal_role_assignments` for deleted workspaces (via `workspace_id` FK)

---

## What is NOT Automatically Deleted

### **roles table**
```sql
-- NO foreign key to auth.users
created_by UUID NOT NULL,  -- NOT a foreign key!
updated_by UUID NOT NULL,  -- NOT a foreign key!
```

**Result:** Role definitions themselves are **NOT deleted** (they're system-wide definitions).
- However, all `permissions` linked to those roles via `role_id` will be deleted if the role is deleted.

### **permissions table**
```sql
-- Only has FK to roles table
role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
```

**Result:** Permissions are **NOT directly deleted** by user deletion.
- They're only deleted if their parent role is deleted.

---

## Summary Table

| Table | Direct Impact | Secondary Impact | Reason |
|-------|---------------|------------------|--------|
| **organization_members** | ✅ DELETED | - | `user_id` FK with CASCADE |
| **team_members** | ✅ DELETED | - | `user_id` FK with CASCADE |
| **organizations** | ✅ DELETED | Cascades to workspaces, teams | `created_by`/`updated_by` FK with CASCADE |
| **workspaces** | ✅ DELETED | Cascades to role assignments | `created_by`/`updated_by` FK with CASCADE |
| **teams** | ✅ DELETED | Cascades to team_members | `created_by`/`updated_by` FK with CASCADE |
| **principal_role_assignments** | ✅ DELETED | - | `created_by`/`updated_by` FK with CASCADE |
| **roles** | ❌ NOT DELETED | - | No direct FK to users |
| **permissions** | ❌ NOT DELETED | - | Only deleted if role is deleted |

---

## Important Considerations

### 1. **Soft Deletes Are NOT Used for User Deletion**
The `deleted_at` columns in `organizations` and `workspaces` are for **soft deletes** (logical deletion).
- User deletion from `auth.users` is a **hard delete** (physical deletion).
- This triggers **hard cascades** via foreign keys.

### 2. **Audit Trail Loss**
When a user is deleted:
- All records showing who created/updated them are **permanently removed**
- No audit trail remains
- Consider implementing audit logging before user deletion

### 3. **Data Integrity**
The cascade behavior ensures **referential integrity**:
- No orphaned records left behind
- Database remains consistent
- No foreign key constraint violations

### 4. **Roles and Permissions Survive**
- System-wide role definitions persist
- Permissions persist (unless their role is deleted)
- This is intentional: roles are reusable across the system

---

## Recommended Approach for User Deletion

Instead of directly deleting from `auth.users`, consider:

### **Option 1: Soft Delete Pattern**
```sql
-- Add soft delete to auth.users (if possible)
ALTER TABLE auth.users ADD COLUMN deleted_at TIMESTAMPTZ;

-- Then use soft delete instead of hard delete
UPDATE auth.users SET deleted_at = now() WHERE id = 'user-id';
```

### **Option 2: Archive User Data**
```sql
-- Before deletion, archive user's data
INSERT INTO user_archive SELECT * FROM organizations WHERE created_by = 'user-id';
INSERT INTO user_archive SELECT * FROM workspaces WHERE created_by = 'user-id';

-- Then delete
DELETE FROM auth.users WHERE id = 'user-id';
```

### **Option 3: Reassign Ownership**
```sql
-- Reassign user's organizations/workspaces to another user
UPDATE organizations SET created_by = 'admin-id', updated_by = 'admin-id' 
WHERE created_by = 'user-id';

UPDATE workspaces SET created_by = 'admin-id', updated_by = 'admin-id' 
WHERE created_by = 'user-id';

-- Then delete
DELETE FROM auth.users WHERE id = 'user-id';
```

---

## Visual Cascade Diagram

```
auth.users (DELETE)
│
├─ organization_members (user_id) ──────────────────────────────────────┐
│                                                                         │
├─ team_members (user_id) ────────────────────────────────────────┐     │
│                                                                  │     │
├─ organizations (created_by/updated_by)                          │     │
│   ├─ workspaces (organization_id)                               │     │
│   │   └─ principal_role_assignments (workspace_id)              │     │
│   ├─ teams (org_id)                                             │     │
│   │   └─ team_members (team_id) ◄─────────────────────────────┘     │
│   └─ principal_role_assignments (org_id)                        │     │
│                                                                  │     │
├─ workspaces (created_by/updated_by)                             │     │
│   └─ principal_role_assignments (workspace_id)                  │     │
│                                                                  │     │
├─ teams (created_by/updated_by)                                  │     │
│   └─ team_members (team_id) ◄──────────────────────────────────┘     │
│                                                                        │
└─ principal_role_assignments (created_by/updated_by) ◄────────────────┘

✅ = Deleted
❌ = NOT deleted (roles, permissions survive)
```

---

## Conclusion

**YES, all related records WILL be deleted** when a user is removed from `auth.users` due to the `ON DELETE CASCADE` constraints throughout the schema. This is a **hard delete cascade** that removes:

✅ All organization memberships
✅ All team memberships  
✅ All organizations they created
✅ All workspaces they created
✅ All teams they created
✅ All role assignments they created
✅ All role assignments in deleted organizations/workspaces

❌ System-wide role definitions (persist)
❌ Permission definitions (persist unless role deleted)

**Recommendation:** Implement safeguards before user deletion, such as archiving data or reassigning ownership to prevent unintended data loss.
