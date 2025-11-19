-- Define assign_owner_role function to handle permission assignment
CREATE OR REPLACE FUNCTION public.assign_owner_role(
    object_id_param UUID,
    user_id_param UUID,
    object_type_param TEXT,
    org_id_param UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
