-- Add triggers for automatic ownership assignment

-- Function to assign ownership using the assignOwnership logic (assumes it exists or needs SQL equivalent)
CREATE OR REPLACE FUNCTION public.assign_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_TABLE_NAME = 'organizations' THEN
        PERFORM public.assign_owner_role(NEW.id, NEW.created_by, 'organization', NEW.id);
    ELSIF TG_TABLE_NAME = 'workspaces' THEN
        PERFORM public.assign_owner_role(NEW.id, NEW.created_by, 'workspace', NEW.organization_id);
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger for organizations table
CREATE TRIGGER trg_assign_ownership_organizations
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.assign_ownership();

-- Trigger for workspaces table
CREATE TRIGGER trg_assign_ownership_workspaces
AFTER INSERT ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.assign_ownership();

-- Note: This assumes a function assign_owner_role exists. If not, define it or integrate with existing logic.
