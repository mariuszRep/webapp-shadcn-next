"use client"

import * as React from "react"
import { ChevronsUpDown, Plus, Folder } from "lucide-react"
import { useRouter, useParams } from "next/navigation"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import type { Workspace } from "@/lib/types/database"
import { createWorkspace } from "@/lib/actions/workspace-actions"

interface WorkspaceSwitcherProps {
  workspaces: Workspace[]
}

export function WorkspaceSwitcher({ workspaces }: WorkspaceSwitcherProps) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const params = useParams()
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [workspaceName, setWorkspaceName] = React.useState("")
  const [isPending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  const organizationId = params?.organizationId as string | undefined
  const workspaceId = params?.workspaceId as string | undefined

  // Find active workspace from URL params
  const activeWorkspace = workspaces.find((w) => w.id === workspaceId) || workspaces[0]

  const handleWorkspaceSwitch = (workspace: Workspace) => {
    if (organizationId) {
      router.push(`/organization/${organizationId}/workspace/${workspace.id}/portal`)
    }
  }

  const handleCreateWorkspace = () => {
    if (!organizationId) {
      setError("Organization ID not found")
      return
    }

    if (!workspaceName.trim()) {
      setError("Workspace name is required")
      return
    }

    setError(null)

    startTransition(async () => {
      const result = await createWorkspace(organizationId, workspaceName)

      if (result.success && result.workspace) {
        setIsDialogOpen(false)
        setWorkspaceName("")
        router.push(`/organization/${organizationId}/workspace/${result.workspace.id}/portal`)
        router.refresh()
      } else {
        setError(result.error || "Failed to create workspace")
      }
    })
  }

  if (!activeWorkspace) {
    return null
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Folder className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{activeWorkspace.name}</span>
                  <span className="truncate text-xs text-muted-foreground">Workspace</span>
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Workspaces
              </DropdownMenuLabel>
              {workspaces.map((workspace, index) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => handleWorkspaceSwitch(workspace)}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    <Folder className="size-3.5 shrink-0" />
                  </div>
                  {workspace.name}
                  <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 p-2"
                onClick={() => setIsDialogOpen(true)}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <div className="text-muted-foreground font-medium">Add workspace</div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              Add a new workspace to organize your work.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Workspace Name</Label>
              <Input
                id="name"
                placeholder="My Workspace"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isPending) {
                    handleCreateWorkspace()
                  }
                }}
                disabled={isPending}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false)
                setWorkspaceName("")
                setError(null)
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateWorkspace} disabled={isPending}>
              {isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
