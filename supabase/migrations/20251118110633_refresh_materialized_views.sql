-- Refresh materialized views to ensure they contain current data
REFRESH MATERIALIZED VIEW CONCURRENTLY public.organization_members_view;
REFRESH MATERIALIZED VIEW CONCURRENTLY public.workspace_members_view;
