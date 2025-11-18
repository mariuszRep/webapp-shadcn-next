'use client'

import * as React from 'react'
import { Folder, Shield } from 'lucide-react'
import { OrganizationSwitcher } from '@/components/organization-switcher'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import type { Organization } from '@/lib/types/database'

export type SettingsSection = 'workspaces' | 'permissions'

interface SettingsSidebarProps extends React.ComponentProps<typeof Sidebar> {
  organizations: Organization[]
  selectedOrgId: string | null
  onSelectOrg: (orgId: string) => void
  onOrganizationsChange: () => void
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
  user: {
    name: string
    email: string
    avatar: string
  }
  navigationDisabled?: boolean
}

const navItems: { value: SettingsSection; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    value: 'workspaces',
    label: 'Workspaces',
    description: 'Manage organization workspaces',
    icon: Folder,
  },
  {
    value: 'permissions',
    label: 'Permissions',
    description: 'Control member access',
    icon: Shield,
  },
]

export function SettingsSidebar({
  organizations,
  selectedOrgId,
  onSelectOrg,
  onOrganizationsChange,
  activeSection,
  onSectionChange,
  user,
  navigationDisabled,
  ...sidebarProps
}: SettingsSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...sidebarProps}>
      <SidebarHeader>
        <OrganizationSwitcher
          organizations={organizations}
          selectedOrgId={selectedOrgId}
          onSelectOrg={onSelectOrg}
          onOrganizationsChange={onOrganizationsChange}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.value}>
                <SidebarMenuButton
                  tooltip={item.label}
                  isActive={activeSection === item.value}
                  onClick={() => onSectionChange(item.value)}
                  disabled={navigationDisabled}
                  aria-current={activeSection === item.value ? 'page' : undefined}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
