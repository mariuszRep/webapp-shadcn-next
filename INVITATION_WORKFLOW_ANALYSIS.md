# Invitation Workflow Analysis & Proposed Changes

## Current Workflow (Step-by-Step)

### **Step 1: Admin Invites User**
```
Admin calls: inviteOrgMember(orgId, email)
```

### **Step 2: Supabase Auth Creates Invitation**
```
adminClient.auth.admin.inviteUserByEmail(email, {
  data: { organization_id: orgId }
})
```
**Result:** 
- ✅ New user record created in `auth.users` (unconfirmed)
- ✅ Invitation email sent to user
- ✅ User metadata contains `organization_id`

### **Step 3: Workspace Created IMMEDIATELY**
```
// Lines 71-86 in member-actions.ts
adminClient.from('workspaces').insert({
  name: `${email.split('@')[0]}'s Workspace`,
  organization_id: orgId,
  created_by: inviteData.user.id,
  updated_by: inviteData.user.id,
})
```
**Result:**
- ✅ Workspace created before user accepts invitation
- ✅ Workspace owned by the invited user

### **Step 4: Roles Assigned IMMEDIATELY**
```
// Lines 105-143 in member-actions.ts
- org_member role assigned (org-level)
- workspace_owner role assigned (workspace-level)
```
**Result:**
- ✅ User has permissions before they even accept the invitation

### **Step 5: User Accepts Invitation**
```
User clicks link in email → Confirms email → Sets password
```

### **Step 6: Auto-Provision Trigger Fires**
```
-- From migration 20251114000005_update_auto_provision_with_rbac.sql
TRIGGER on_auth_user_created AFTER INSERT ON auth.users
```

**Result:**
- ✅ Personal organization created
- ✅ Personal workspace created
- ✅ org_owner role assigned to Personal org
- ✅ workspace_owner role assigned to Personal workspace

---

## Problem with Current Workflow

### **Issue 1: Workspace Created Before User Confirms**
- Workspace is created when invitation is sent
- If user never accepts invitation, orphaned workspace remains
- Wasted database records for unconfirmed users

### **Issue 2: Redundant Personal Organization**
- Auto-provision trigger creates Personal org when user confirms
- But workspace was already created in the invited organization
- User ends up with:
  - Personal org (created by trigger)
  - Personal workspace (in Personal org)
  - Invited org (created by admin)
  - Workspace in invited org (created by invitation)

### **Issue 3: Timing Mismatch**
- Workspace created at invitation time (before confirmation)
- Personal org created at confirmation time (after confirmation)
- Inconsistent provisioning logic

---

## Proposed Solution

### **New Workflow: Create Workspace on Confirmation**

#### **Step 1: Admin Invites User** ✅ (No Change)
```
Admin calls: inviteOrgMember(orgId, email)
```

#### **Step 2: Supabase Auth Creates Invitation** ✅ (No Change)
```
adminClient.auth.admin.inviteUserByEmail(email, {
  data: { organization_id: orgId }
})
```

#### **Step 3: Add to organization_members** ✅ (No Change)
```
Add user to organization_members table
```

#### **Step 4: Assign org_member Role** ✅ (No Change)
```
Assign org_member role (org-level)
```

#### **Step 5: DO NOT CREATE WORKSPACE** ❌ (REMOVE)
```
// DELETE THIS SECTION (lines 71-86)
// DO NOT create workspace here
```

#### **Step 6: User Accepts Invitation**
```
User clicks link in email → Confirms email → Sets password
```

#### **Step 7: Auto-Provision Trigger Fires** ✅ (Enhance)
```
TRIGGER on_auth_user_created AFTER INSERT ON auth.users
```

**Current behavior:**
- Creates Personal org
- Creates Personal workspace
- Assigns roles

**Enhanced behavior (NEW):**
- Creates Personal org ✅
- Creates Personal workspace ✅
- Assigns roles ✅
- **NEW:** Check if user was invited to any organizations
- **NEW:** For each organization they were invited to:
  - Create a workspace named after them
  - Assign workspace_owner role

---

## Implementation Plan

### **Phase 1: Modify inviteOrgMember()**

**File:** `lib/actions/member-actions.ts`

**Changes:**
```typescript
export async function inviteOrgMember(
  orgId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // ... existing code ...

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

    // Assign org_member role
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
      }
    }

    // ❌ REMOVE EVERYTHING BELOW THIS LINE (lines 71-143)
    // - DO NOT create workspace
    // - DO NOT assign workspace_owner role
    // This will happen when user accepts the invitation

    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    console.error('Unexpected error inviting member:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
```

### **Phase 2: Enhance Auto-Provision Trigger**

**File:** `supabase/migrations/20251114000007_enhance_auto_provision_for_invitations.sql` (NEW)

**Changes:**
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
  org_record RECORD;
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

  -- ===== PERSONAL ORG/WORKSPACE PROVISIONING =====
  
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

  -- ===== INVITED ORG/WORKSPACE PROVISIONING (NEW) =====
  
  -- Check if user was invited to any organizations
  FOR org_record IN
    SELECT DISTINCT org_id
    FROM public.organization_members
    WHERE user_id = NEW.id
    AND org_id != new_org_id  -- Exclude Personal org
    AND deleted_at IS NULL
  LOOP
    invited_org_id := org_record.org_id;

    -- Create a workspace for the user in the invited organization
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

    -- Assign workspace_owner role for the new workspace
    IF workspace_owner_role_id IS NOT NULL THEN
      INSERT INTO public.principal_role_assignments
        (principal_kind, principal_id, org_id, workspace_id, role_id, created_by, updated_by)
      VALUES
        ('user', NEW.id, invited_org_id, invited_workspace_id, workspace_owner_role_id, NEW.id, NEW.id)
      ON CONFLICT DO NOTHING;  -- Skip if already assigned
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
```

---

## Benefits of Proposed Solution

### **1. Clean Separation of Concerns**
- Invitation = Add to organization + Assign role
- Confirmation = Create workspaces + Full provisioning

### **2. No Orphaned Workspaces**
- Workspaces only created when user confirms
- Unconfirmed invitations don't create database records

### **3. Consistent Provisioning**
- All workspaces created at same time (on confirmation)
- All role assignments happen together
- Single source of truth: auto-provision trigger

### **4. Better User Experience**
- User accepts invitation → Logs in → Sees workspace ready
- No "pending" state for workspaces
- Immediate access to workspace upon first login

### **5. Easier to Debug**
- Invitation process is simple: add member + role
- Provisioning process is centralized in trigger
- Clear separation between admin actions and system actions

---

## Migration Path

### **For Existing Invited Users**

Users who were invited before this change already have workspaces. They're fine.

### **For New Invitations**

After deploying the changes:
1. Remove workspace creation from `inviteOrgMember()`
2. Deploy enhanced auto-provision trigger
3. New invitations will follow the new workflow

### **No Data Loss**

- Existing workspaces remain
- Existing role assignments remain
- Only affects new invitations going forward

---

## Testing Checklist

- [ ] Invite user to organization
- [ ] Verify NO workspace created immediately
- [ ] Verify user added to organization_members
- [ ] Verify org_member role assigned
- [ ] User accepts invitation
- [ ] Verify Personal org created
- [ ] Verify Personal workspace created
- [ ] Verify workspace created in invited organization
- [ ] Verify workspace_owner role assigned for invited org workspace
- [ ] Verify user can access both workspaces
- [ ] Verify user has correct permissions in each workspace

---

## Summary

**Current:** Workspace created at invitation time (before confirmation)
**Proposed:** Workspace created at confirmation time (after user accepts)

**Result:** Cleaner, more consistent, no orphaned records, better UX.
