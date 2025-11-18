-- Check if triggers exist
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%users_permissions%'
ORDER BY trigger_name;

-- Check permissions table
SELECT COUNT(*) as permissions_count,
       COUNT(DISTINCT object_type) as object_types
FROM public.permissions
WHERE deleted_at IS NULL;

-- Check view
SELECT COUNT(*) as view_count FROM public.users_permissions;

-- Sample from view
SELECT * FROM public.users_permissions LIMIT 5;

-- Check if view needs manual refresh
SELECT 'View exists: ' || CASE WHEN COUNT(*) > 0 THEN 'YES' ELSE 'NO' END as status
FROM pg_matviews
WHERE matviewname = 'users_permissions';
