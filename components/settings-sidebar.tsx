'use client'

import * as React from 'react'
import { Folder, Shield } from 'lucide-react'
import { OrganizationSwitcher } from '@/components/organization-switcher'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.value}>
              <SidebarMenuButton
                size="lg"
                isActive={activeSection === item.value}
                onClick={() => onSectionChange(item.value)}
                disabled={navigationDisabled}
                className="items-start"
              >
                <item.icon className="mt-0.5 size-4" />
                <div className="grid flex-1 text-left">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.description}</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
