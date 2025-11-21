-- =====================================================
-- RLS POLICY TESTING
-- =====================================================

-- Step 1: Find a real user ID from your database
SELECT id, email FROM auth.users LIMIT 5;

-- Step 2: Check what permissions this user has
SELECT p.*, r.name as role_name, r.permissions as role_permissions
FROM permissions p
JOIN roles r ON p.role_id = r.id
WHERE p.principal_type = 'user'
  AND p.principal_id = 'YOUR_USER_ID_HERE'
  AND p.deleted_at IS NULL;

-- Step 3: Test as that user by setting JWT claims
BEGIN;
-- Set the user context (replace with your user ID)
SET LOCAL request.jwt.claims = '{"sub": "YOUR_USER_ID_HERE", "role": "authenticated"}';

-- Now test queries - they will go through RLS
SELECT * FROM organizations;
SELECT * FROM workspaces;
SELECT * FROM permissions;
SELECT * FROM roles;

ROLLBACK; -- Reset context

-- =====================================================
-- Test different user scenarios
-- =====================================================

-- Test as Owner
BEGIN;
SET LOCAL request.jwt.claims = '{"sub": "OWNER_USER_ID", "role": "authenticated"}';
SELECT COUNT(*) as workspace_count FROM workspaces;
SELECT COUNT(*) as permission_count FROM permissions;
ROLLBACK;

-- Test as Member
BEGIN;
SET LOCAL request.jwt.claims = '{"sub": "MEMBER_USER_ID", "role": "authenticated"}';
SELECT COUNT(*) as workspace_count FROM workspaces;
SELECT COUNT(*) as permission_count FROM permissions;
ROLLBACK;

-- =====================================================
-- Check what a specific policy would allow
-- =====================================================

-- See what the policy logic evaluates to for a user
SELECT
  w.*,
  -- Check if user has direct workspace permission
  w.id IN (
    SELECT object_id FROM permissions
    WHERE principal_id = 'YOUR_USER_ID'
    AND object_type = 'workspace'
    AND deleted_at IS NULL
  ) as has_direct_access,
  -- Check if user is owner/admin of org
  w.organization_id IN (
    SELECT p.object_id FROM permissions p
    JOIN roles r ON p.role_id = r.id
    WHERE p.principal_id = 'YOUR_USER_ID'
    AND p.object_type = 'organization'
    AND r.name IN ('owner', 'admin')
    AND p.deleted_at IS NULL
  ) as is_org_owner_admin
FROM workspaces w;
