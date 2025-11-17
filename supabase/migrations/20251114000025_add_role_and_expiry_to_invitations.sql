-- Add role_id and expiry_at columns to invitations table
-- This allows invitations to specify the role and automatically expire

-- Add role_id column to store the intended role for the invited user
ALTER TABLE public.invitations
ADD COLUMN role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;

-- Add expiry_at column with default of 7 days from creation
ALTER TABLE public.invitations
ADD COLUMN expiry_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days');

-- Add index for fast lookup of expired invitations
CREATE INDEX IF NOT EXISTS invitations_expiry_idx
ON public.invitations(expiry_at)
WHERE deleted_at IS NULL AND accepted_at IS NULL;

-- Update existing invitations to have expiry_at set
UPDATE public.invitations
SET expiry_at = created_at + INTERVAL '7 days'
WHERE expiry_at IS NULL;

-- Add comment explaining the new columns
COMMENT ON COLUMN public.invitations.role_id IS 'Optional role to assign to user upon accepting invitation. If NULL, defaults to org_member role.';
COMMENT ON COLUMN public.invitations.expiry_at IS 'Timestamp when invitation expires. Defaults to 7 days from creation.';
