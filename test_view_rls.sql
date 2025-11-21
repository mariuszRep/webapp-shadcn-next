-- Test if users can see their permissions through RLS
set role authenticated;
set "request.jwt.claim.sub" to '95181460-8b9b-4202-ad9c-ebd1a1ea5b91';

-- Test 1: Can user see their permissions directly?
SELECT * FROM permissions
WHERE principal_type = 'user'
  AND principal_id = '95181460-8b9b-4202-ad9c-ebd1a1ea5b91'
  AND deleted_at IS NULL;

-- Test 2: Can user see their roles?
SELECT * FROM roles WHERE id IN (
  SELECT role_id FROM permissions
  WHERE principal_type = 'user'
    AND principal_id = '95181460-8b9b-4202-ad9c-ebd1a1ea5b91'
    AND deleted_at IS NULL
);

-- Test 3: Can user see through the view?
SELECT * FROM users_permissions
WHERE user_id = '95181460-8b9b-4202-ad9c-ebd1a1ea5b91';

-- Test 4: Can user see organizations through the view?
SELECT * FROM users_permissions
WHERE object_type = 'organization';
