drop policy "select_permissions" on "public"."permissions";


  create policy "select_permissions"
  on "public"."permissions"
  as permissive
  for select
  to authenticated
using ((((principal_type = 'user'::text) AND (principal_id = auth.uid())) OR public.user_has_role_on_object(auth.uid(), 'organization'::text, object_id, ARRAY['owner'::text, 'admin'::text])));



