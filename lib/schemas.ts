import { z } from 'zod'

// =====================================================
// PERMISSION SCHEMAS
// =====================================================

const permissionActionEnum = z.enum(['select', 'insert', 'update', 'delete'])
const objectTypeEnum = z.enum(['organization', 'workspace'])

export const addPermissionSchema = z.object({
  principal_id: z.string().uuid('Invalid user ID'),
  role_id: z.string().uuid('Invalid role ID'),
  object_type: objectTypeEnum,
  object_id: z.string().uuid('Invalid object ID').nullable(),
})

export type AddPermissionInput = z.infer<typeof addPermissionSchema>

// Form schema (without org_id - it's added programmatically)
export const roleFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Role name is required')
    .max(100, 'Role name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  permissions: z
    .array(permissionActionEnum)
    .min(1, 'At least one permission is required'),
})

export type RoleFormInput = z.infer<typeof roleFormSchema>

// Server action schema (includes org_id)
export const addRoleSchema = z.object({
  name: z
    .string()
    .min(1, 'Role name is required')
    .max(100, 'Role name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  permissions: z
    .array(permissionActionEnum)
    .min(1, 'At least one permission is required'),
  org_id: z.string().uuid('Invalid organization ID'),
})

export type AddRoleInput = z.infer<typeof addRoleSchema>

export const updateRoleSchema = z.object({
  name: z
    .string()
    .min(1, 'Role name is required')
    .max(100, 'Role name must be less than 100 characters')
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  permissions: z.array(permissionActionEnum).optional(),
})

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>
