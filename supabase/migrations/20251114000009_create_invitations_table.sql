-- Create invitations table to track pending organization invitations
-- This allows the trigger to know which organization a user was invited to

CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT invitations_email_org_unique UNIQUE (email, org_id)
);

-- Add index for fast lookup by email
CREATE INDEX IF NOT EXISTS invitations_email_idx ON public.invitations(email) WHERE deleted_at IS NULL AND accepted_at IS NULL;

-- RLS policies
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Organization owners can view invitations for their org
CREATE POLICY "Users can view invitations for their orgs"
  ON public.invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.org_id = invitations.org_id
        AND om.user_id = auth.uid()
        AND om.deleted_at IS NULL
    )
  );

-- Users with manage_members permission can create invitations
CREATE POLICY "Users can create invitations with permission"
  ON public.invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.org_id = invitations.org_id
        AND om.user_id = auth.uid()
        AND om.deleted_at IS NULL
    )
  );

COMMENT ON TABLE public.invitations IS 'Tracks pending organization invitations. Used by auth trigger to provision users correctly.';
