-- Create enum type for invitation status
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired');

-- Create invitations table
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for query performance
CREATE INDEX idx_invitations_user_id ON invitations(user_id);
CREATE INDEX idx_invitations_created_by ON invitations(created_by);
CREATE INDEX idx_invitations_status ON invitations(status);

-- Enable RLS on invitations table
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view invitations they created
CREATE POLICY "Users can view invitations they created"
ON invitations
FOR SELECT
USING (auth.uid() = created_by);

-- Policy: Users can view their own invitations
CREATE POLICY "Users can view their own invitations"
ON invitations
FOR SELECT
USING (auth.uid() = user_id);
