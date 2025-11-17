export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Standardized permission types aligned with SQL terminology
export type PrincipalType = 'user' | 'team'
export type ObjectType = 'organization' | 'workspace'
export type PermissionAction = 'select' | 'insert' | 'update' | 'delete'

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
          created_by: string
          updated_by: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
          created_by: string
          updated_by: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
          created_by?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      workspaces: {
        Row: {
          id: string
          name: string
          organization_id: string
          created_at: string
          updated_at: string
          created_by: string
          updated_by: string
        }
        Insert: {
          id?: string
          name: string
          organization_id: string
          created_at?: string
          updated_at?: string
          created_by: string
          updated_by: string
        }
        Update: {
          id?: string
          name?: string
          organization_id?: string
          created_at?: string
          updated_at?: string
          created_by?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspaces_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      roles: {
        Row: {
          id: string
          name: string
          description: string | null
          permissions: PermissionAction[]
          org_id: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          permissions?: PermissionAction[]
          org_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          permissions?: PermissionAction[]
          org_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      permissions: {
        Row: {
          id: string
          org_id: string
          principal_type: PrincipalType
          principal_id: string
          role_id: string
          object_type: ObjectType
          object_id: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          created_by: string
          updated_by: string
        }
        Insert: {
          id?: string
          org_id: string
          principal_type: PrincipalType
          principal_id: string
          role_id: string
          object_type: ObjectType
          object_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          created_by: string
          updated_by: string
        }
        Update: {
          id?: string
          org_id?: string
          principal_type?: PrincipalType
          principal_id?: string
          role_id?: string
          object_type?: ObjectType
          object_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          created_by?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      organization_members_view: {
        Row: {
          org_id: string
          user_id: string
          role_id: string
          role_name: string
        }
      }
      workspace_members_view: {
        Row: {
          workspace_id: string
          user_id: string
          role_id: string
          role_name: string
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience type exports
export type Organization = Database['public']['Tables']['organizations']['Row']
export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type Role = Database['public']['Tables']['roles']['Row']
export type Permission = Database['public']['Tables']['permissions']['Row']
export type OrganizationMemberView = Database['public']['Views']['organization_members_view']['Row']
export type WorkspaceMemberView = Database['public']['Views']['workspace_members_view']['Row']
