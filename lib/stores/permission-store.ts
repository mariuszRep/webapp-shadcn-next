import { create } from 'zustand'
import type { Role } from '@/lib/types/database'

interface PermissionStoreState {
  addPermissionOpen: boolean
  addRoleOpen: boolean
  editRoleOpen: boolean
  selectedRole: Role | null
  setAddPermissionOpen: (open: boolean) => void
  setAddRoleOpen: (open: boolean) => void
  setEditRoleOpen: (open: boolean) => void
  setSelectedRole: (role: Role | null) => void
}

export const usePermissionStore = create<PermissionStoreState>((set) => ({
  addPermissionOpen: false,
  addRoleOpen: false,
  editRoleOpen: false,
  selectedRole: null,
  setAddPermissionOpen: (open) => set({ addPermissionOpen: open }),
  setAddRoleOpen: (open) => set({ addRoleOpen: open }),
  setEditRoleOpen: (open) => set({ editRoleOpen: open }),
  setSelectedRole: (role) => set({ selectedRole: role }),
}))
