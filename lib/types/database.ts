export interface Organization {
  id: string
  name: string
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
}

export interface Workspace {
  id: string
  name: string
  organization_id: string
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
}
