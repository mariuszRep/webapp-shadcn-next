# Epic 1267: Unified Permissions System Implementation - Analysis

## Epic Overview

**ID**: 1267  
**Title**: Unified Permissions System Implementation  
**Stage**: Draft  
**Parent Project**: 1214 - SaaS Platform (Vercel + Supabase + Stripe with Next.js)

### Description
Implement a centralized, extensible role-based access control (RBAC) system that supports organization-level and workspace-level permissions with type-specific granularity. The system enables team collaboration, fine-grained access control, and supports future workspace entities (tasks, epics, projects) and workflows without schema changes.

### Key Features
- Central permissions table with generic principal_role_assignments
- RLS policies enforced at database level
- Type-specific permissions (e.g., edit tasks but not epics)
- Plural table naming convention (teams, roles, permissions, organizations, workspaces)
- Workflows as separate resources distinct from entities
- Extensible architecture for future workspace resources

---

## Related Tasks (4)

### Task 1268: Create Core RBAC Database Schema with Plural Table Names
**Stage**: Draft  
**Focus**: Database schema foundation

**Key Deliverables**:
- `principal_kind` enum (user, team)
- `resource_kind` enum (organization, workspace, entity_instance, entity_type, workflow)
- Tables: organization_members, teams, team_members, roles, principal_role_assignments, permissions
- Performance indexes on all foreign keys and lookup patterns
- Cascading delete configuration

**Attached Rules**:
- ✅ Rule 1216: Supabase Database Design & Integration
- ✅ Rule 1258: Always Use Supabase CLI for Production Database Operations

---

### Task 1269: Implement Central Permission Function and RLS Policies
**Stage**: Draft  
**Focus**: Permission checking logic and security

**Key Deliverables**:
- `has_permission()` PostgreSQL function (security definer)
- `is_org_member()` helper function
- RLS policies on: organizations, workspaces, teams, team_members, principal_role_assignments
- Support for org-level role inheritance
- Team membership permission grants
- Entity-type-specific permission handling

**Attached Rules**:
- ✅ Rule 1216: Supabase Database Design & Integration
- ✅ Rule 1217: Supabase Authentication & Authorization
- ✅ Rule 1258: Always Use Supabase CLI for Production Database Operations

---

### Task 1270: Seed Roles, Permissions and Entity System Extensibility
**Stage**: Draft  
**Focus**: Initial data and extensibility patterns

**Key Deliverables**:
- Seed roles: org_owner, org_admin, org_member, workspace_owner, workspace_editor, workspace_viewer, task_editor, project_editor
- Seed permissions for each role with appropriate scoping
- entity_types and entities tables as extensibility examples
- RLS policies on entity tables
- Extensibility documentation for adding new workspace resources

**Attached Rules**:
- ✅ Rule 1216: Supabase Database Design & Integration
- ✅ Rule 1258: Always Use Supabase CLI for Production Database Operations

---

### Task 1271: Integrate TypeScript Utilities and Member Management UI
**Stage**: Draft  
**Focus**: Application integration and UI

**Key Deliverables**:
- TypeScript types in `lib/types/rbac.ts`
- Permission utilities in `lib/utils/permissions.ts` (hasPermission, requirePermission, isOrgMember)
- Updated server actions: organization-actions.ts, workspace-actions.ts
- New actions: member-actions.ts, role-actions.ts
- UI components: member-manager.tsx, role-manager.tsx
- Migration script: scripts/migrate-to-rbac.ts

**Attached Rules**:
- ✅ Rule 1215: Next.js + shadcn/ui + React Flow Component Development
- ✅ Rule 1249: UI Best Practices with shadcn/ui and Next.js
- ✅ Rule 1217: Supabase Authentication & Authorization

---

## Relevant Rules Attached

### Database & Backend Rules

**Rule 1216: Supabase Database Design & Integration**
- Attached to: Tasks 1268, 1269, 1270
- Relevance: Core database schema, migrations, RLS policies, type generation
- Key guidance: Migration-based changes, RLS for all tables, TypeScript type generation

**Rule 1217: Supabase Authentication & Authorization**
- Attached to: Tasks 1269, 1271
- Relevance: Auth flows, session management, RBAC implementation
- Key guidance: Server-side session management, role storage, permission checking

**Rule 1258: Always Use Supabase CLI for Production Database Operations**
- Attached to: Tasks 1268, 1269, 1270
- Relevance: Safe production deployments, migration management
- Key guidance: Use `supabase db push --linked`, create versioned migrations, maintain audit trail

### Frontend & UI Rules

**Rule 1215: Next.js + shadcn/ui + React Flow Component Development**
- Attached to: Task 1271
- Relevance: UI component development for member/role management
- Key guidance: App Router patterns, shadcn/ui components, TypeScript strict mode, react-hook-form

**Rule 1249: UI Best Practices with shadcn/ui and Next.js**
- Attached to: Task 1271
- Relevance: Consistent UI development for management interfaces
- Key guidance: CLI-based component management, dark mode, accessibility, responsive design

---

## Additional Relevant Rules (Not Attached)

These rules may be useful for reference but are not directly attached to tasks:

### Rule 1218: Stripe Subscription & Payment Integration
- Potential relevance: If permission tiers are tied to subscription levels
- Not attached: No direct payment integration in current scope

### Rule 1220: Shared Service Layer Pattern
- Potential relevance: Service layer for permission checking logic
- Not attached: Could be applied if refactoring to service pattern

### Rule 1239: MCP Server with Next.js on Vercel
- Potential relevance: If exposing permissions via MCP protocol
- Not attached: No MCP integration in current scope

### Rule 1251: Organize Web vs App Components Using Next.js Route Groups
- Potential relevance: Organizing member management UI in (app) route group
- Not attached: Architecture already established

---

## Implementation Strategy

### Phase 1: Database Foundation (Task 1268)
1. Create enums and core tables
2. Add indexes and constraints
3. Test schema with sample data
4. Generate TypeScript types

### Phase 2: Security Layer (Task 1269)
1. Implement permission functions
2. Create RLS policies
3. Test permission inheritance
4. Verify entity-type-specific permissions

### Phase 3: Data & Documentation (Task 1270)
1. Seed roles and permissions
2. Create entity system examples
3. Document extensibility patterns
4. Test type-specific permissions

### Phase 4: Application Integration (Task 1271)
1. Create TypeScript utilities
2. Update server actions
3. Build UI components
4. Create migration script
5. Test end-to-end flows

---

## Success Criteria

- ✅ Zero entity-specific role tables (unified principal_role_assignments only)
- ✅ Single central permissions table
- ✅ RLS policies on all tables using has_permission
- ✅ Org-level roles inherit to workspace level
- ✅ Type-specific permissions functional
- ✅ All users migrated with appropriate roles
- ✅ Member/role management UI functional
- ✅ Extensibility documentation complete
- ✅ Plural naming convention throughout
- ✅ Workflows separate from entities
- ✅ Performance indexes on all lookup paths
- ✅ Migration rollback scripts available

---

## Architecture Highlights

### Permission Checking Flow
```
User Request → has_permission(resource, action, org_id, workspace_id?, entity_type_id?)
  ↓
1. Get principals (user + teams)
2. Get roles (with inheritance)
3. Check permissions (with scoping)
  ↓
Boolean result → RLS policy enforcement
```

### Table Relationships
```
organizations
  ↓ organization_members
  ↓ teams → team_members
  ↓ workspaces
       ↓ entities → entity_types

roles ← principal_role_assignments → (users/teams)
  ↓
permissions (with scoping flags)
```

### Extensibility Pattern
1. Add resource_kind enum value
2. Create table with workspace_id FK
3. Apply RLS using has_permission
4. Insert permissions for existing roles
5. No core infrastructure changes needed

---

**Generated**: 2025-11-14  
**Status**: Ready for implementation
