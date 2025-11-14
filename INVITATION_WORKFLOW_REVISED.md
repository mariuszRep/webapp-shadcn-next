# Revised Invitation Workflow - No Redundant Organizations

## Key Insight

**Invited users don't need their own organization.** They only need:
- Membership in the organization they were invited to
- A personal workspace within that organization
- workspace_owner role for their workspace

---

## Revised Workflow

### **Scenario 1: User Signs Up on Their Own (No Invitation)**

**Step 1:** User creates account
**Step 2:** Auto-provision trigger fires
**Step 3:** Creates:
- ✅ Personal organization (owned by user)
- ✅ Personal workspace (in Personal org)
- ✅ org_owner role (for Personal org)
- ✅ workspace_owner role (for Personal workspace)

**Result:** User has their own org + workspace

---

### **Scenario 2: User is Invited to Organization**

**Step 1:** Admin invites user to organization
```
inviteOrgMember(orgId, email)
```

**Step 2:** System creates:
- ✅ User in auth.users (unconfirmed)
- ✅ organization_members record
- ✅ org_member role (org-level)

**Step 3:** User accepts invitation (clicks email link)

**Step 4:** Auto-provision trigger fires

**Step 5:** System checks: "Was this user invited to any organization?"
- ✅ YES → Create personal workspace in that organization
- ✅ Assign workspace_owner role
- ❌ NO → Create Personal org + workspace (Scenario 1)

**Result:** User is member of organization + has personal workspace

---

## Implementation

### **Key Insight: Use Metadata-Based Detection**

Instead of querying the `organization_members` table, we leverage the invitation metadata that's already embedded in the user record. When an invitation is sent with `organization_id` in the metadata, it's automatically transferred to the user's `raw_user_meta_data` when they confirm their email.

**Advantages:**
- ✅ No extra database queries
- ✅ No race conditions
- ✅ Metadata is guaranteed to be present if user was invited
- ✅ Simpler, faster logic

### **Enhanced Auto-Provision Trigger**

**File:** `supabase/migrations/20251114000007_smart_auto_provision.sql` (NEW)

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_org_id UUID;
  new_workspace_id UUID;
  org_owner_role_id UUID;
  workspace_owner_role_id UUID;
  invited_org_id UUID;
  invited_workspace_id UUID;
BEGIN
  -- Get role IDs
  SELECT id INTO org_owner_role_id
  FROM public.roles
  WHERE name = 'org_owner'
  AND deleted_at IS NULL
  LIMIT 1;

  SELECT id INTO workspace_owner_role_id
  FROM public.roles
  WHERE name = 'workspace_owner'
  AND deleted_at IS NULL
  LIMIT 1;

  -- ===== CHECK IF USER WAS INVITED =====
  -- Extract organization_id from user metadata (set during invitation)
  invited_org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;

  -- ===== CASE 1: USER WAS INVITED =====
  IF invited_org_id IS NOT NULL THEN
    -- Create workspace in the invited organization
    INSERT INTO public.workspaces (
      name,
      organization_id,
      created_by,
      updated_by
    )
    VALUES (
      NEW.email || '''s Workspace',
      invited_org_id,
      NEW.id,
      NEW.id
    )
    RETURNING id INTO invited_workspace_id;

    -- Assign workspace_owner role
    IF workspace_owner_role_id IS NOT NULL THEN
      INSERT INTO public.principal_role_assignments
        (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
      VALUES
        ('user', NEW.id, invited_org_id, invited_workspace_id, workspace_owner_role_id, NEW.id, NEW.id)
      ON CONFLICT DO NOTHING;
    END IF;

  -- ===== CASE 2: USER SIGNED UP ON THEIR OWN (NOT INVITED) =====
  ELSE
    -- Insert personal organization
    INSERT INTO public.organizations (name, created_by, updated_by)
    VALUES ('Personal', NEW.id, NEW.id)
    RETURNING id INTO new_org_id;

    -- Insert personal workspace
    INSERT INTO public.workspaces (name, organization_id, created_by, updated_by)
    VALUES ('Personal', new_org_id, NEW.id, NEW.id)
    RETURNING id INTO new_workspace_id;

    -- Add user to organization_members for Personal org
    INSERT INTO public.organization_members (org_id, user_id, created_by, updated_by)
    VALUES (new_org_id, NEW.id, NEW.id, NEW.id);

    -- Assign org_owner role for Personal org
    IF org_owner_role_id IS NOT NULL THEN
      INSERT INTO public.principal_role_assignments
        (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
      VALUES
        ('user', NEW.id, new_org_id, NULL, org_owner_role_id, NEW.id, NEW.id);
    END IF;

    -- Assign workspace_owner role for Personal workspace
    IF workspace_owner_role_id IS NOT NULL THEN
      INSERT INTO public.principal_role_assignments
        (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
      VALUES
        ('user', NEW.id, new_org_id, new_workspace_id, workspace_owner_role_id, NEW.id, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 'Smart auto-provision: creates Personal org for self-signup, or personal workspace for invited users using metadata-based detection';
```

---

## Updated inviteOrgMember() Function

**File:** `lib/actions/member-actions.ts`

```typescript
export async function inviteOrgMember(
  orgId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate email
    if (!email || !email.includes('@')) {
      return { success: false, error: 'Valid email is required' }
    }

    // Check permission to manage members
    await requirePermission('organization', 'manage_members', orgId)

    // Create admin client for invite operation
    const adminClient = createAdminClient()

    // Invite user via Supabase Auth Admin API
    // ✅ KEY: Pass organization_id in metadata - this will be checked by auto-provision trigger
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          organization_id: orgId,  // ← Metadata for trigger to detect invitation
        },
      }
    )

    if (inviteError) {
      console.error('Error inviting user:', inviteError)
      return { success: false, error: 'Failed to send invitation' }
    }

    if (!inviteData.user) {
      return { success: false, error: 'Failed to create user invitation' }
    }

    // Add user to organization_members
    const { error: memberError } = await adminClient
      .from('organization_members')
      .insert({
        org_id: orgId,
        user_id: inviteData.user.id,
        created_by: user.id,
        updated_by: user.id,
      })

    if (memberError) {
      console.error('Error adding organization member:', memberError)
      return { success: false, error: 'Failed to add member to organization' }
    }

    // Assign org_member role (org-level access)
    const { data: orgMemberRole } = await adminClient
      .from('roles')
      .select('id')
      .eq('name', 'org_member')
      .is('deleted_at', null)
      .single()

    if (orgMemberRole) {
      const { error: roleError } = await adminClient
        .from('principal_role_assignments')
        .insert({
          principal_kind: 'user',
          principal_id: inviteData.user.id,
          org_id: orgId,
          workspace_id: null,
          role_id: orgMemberRole.id,
          created_by: user.id,
          updated_by: user.id,
        })

      if (roleError && roleError.code !== '23505') {
        console.error('Error assigning org_member role:', roleError)
        // Don't fail the invitation if role assignment fails
      }
    }

    // ✅ WORKSPACE WILL BE CREATED WHEN USER ACCEPTS INVITATION
    // The auto-provision trigger will read organization_id from user metadata
    // and create workspace in the invited organization

    revalidatePath('/settings')

    return { success: true }
  } catch (error) {
    console.error('Unexpected error inviting member:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
```

---

## User Journey Comparison

### **Before (Current - Redundant)**
```
Invited User:
├─ Personal org (created by trigger)
├─ Personal workspace (in Personal org)
├─ Invited org (created by admin)
└─ Workspace in invited org (created by invitation)
   ❌ REDUNDANT: Two orgs, two workspaces
```

### **After (Revised - Clean)**
```
Invited User:
├─ Invited org (created by admin)
└─ Personal workspace (in invited org)
   ✅ CLEAN: One org, one workspace
```

```
Self-Signup User:
├─ Personal org (created by trigger)
└─ Personal workspace (in Personal org)
   ✅ CLEAN: One org, one workspace
```

---

## Database State After User Accepts Invitation

### **organizations table**
```
id                                   | name              | created_by
------------------------------------|-------------------|----------
d48232b9-c397-4cf8-b7f9-2f67baf1415f | Test Organization | admin-id
```
✅ Only the organization they were invited to

### **workspaces table**
```
id                                   | name                    | organization_id
------------------------------------|------------------------|----------
bd6f88bd-53eb-4127-8d88-9b979578097f | john's Workspace       | d48232b9-...
```
✅ Only their personal workspace in that organization

### **organization_members table**
```
org_id                               | user_id
------------------------------------|----------
d48232b9-c397-4cf8-b7f9-2f67baf1415f | john-id
```
✅ Member of the organization

### **principal_role_assignments table**
```
principal_id | org_id                               | workspace_id                         | role_id
-------------|--------------------------------------|--------------------------------------|----------
john-id      | d48232b9-c397-4cf8-b7f9-2f67baf1415f | NULL                                 | org_member_role_id
john-id      | d48232b9-c397-4cf8-b7f9-2f67baf1415f | bd6f88bd-53eb-4127-8d88-9b979578097f | workspace_owner_role_id
```
✅ org_member (org-level) + workspace_owner (workspace-level)

---

## Benefits

✅ **No redundant organizations** - Invited users don't get Personal org
✅ **Clean database** - Only necessary records created
✅ **Consistent logic** - Auto-provision trigger handles all provisioning
✅ **Better UX** - User logs in → sees their workspace ready
✅ **Easier to understand** - Clear separation: invited vs self-signup
✅ **No extra queries** - Uses metadata already in user record
✅ **No race conditions** - Metadata is guaranteed to be present
✅ **Metadata-driven** - Invitation link carries all needed information

---

## Migration Steps

1. **Remove workspace creation from `inviteOrgMember()`**
   - Delete lines 71-143 from current member-actions.ts
   - Keep only: add to organization_members + assign org_member role

2. **Deploy new auto-provision trigger**
   - Create migration: `20251114000007_smart_auto_provision.sql`
   - Trigger checks if user was invited
   - If invited: create workspace in invited org
   - If not invited: create Personal org + workspace

3. **Test both scenarios**
   - Self-signup: Personal org created ✅
   - Invited: Only workspace in invited org ✅

---

## How It Works End-to-End

### **Step 1: Admin Invites User**
```typescript
await inviteOrgMember(orgId, email)
```
↓ Calls Supabase Auth Admin API with metadata
```typescript
inviteUserByEmail(email, { data: { organization_id: orgId } })
```
✅ Metadata stored in invitation

### **Step 2: User Receives Email**
```
Click here to confirm: https://yourapp.com/auth/callback?token=xxx
```
✅ Token contains the metadata

### **Step 3: User Clicks Link & Confirms**
```
User enters password → Email confirmed → New user created in auth.users
```
✅ Metadata transferred to user.raw_user_meta_data

### **Step 4: Auto-Provision Trigger Fires**
```sql
invited_org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;
```
✅ Reads metadata directly from user record
✅ If organization_id present → Create workspace in invited org
✅ If organization_id absent → Create Personal org + workspace
✅ No extra queries needed!

---

## Summary

**Old approach:** Invited users got redundant Personal org
**New approach:** Invited users get only what they need (workspace in invited org)
**Detection method:** Metadata-based (no extra queries)
**Result:** Cleaner, simpler, no redundancy, no race conditions
