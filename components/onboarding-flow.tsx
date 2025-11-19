'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { acceptInvitation } from '@/lib/actions/invitation-actions'
import {
  createOrganizationWithPermissions,
  createWorkspaceWithPermissions,
} from '@/lib/actions/onboarding-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Check,
  Building2,
  FolderKanban,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  UserCheck,
} from 'lucide-react'

interface InvitationDetails {
  invitationId: string
  organizationId: string
  organizationName: string
  roleName: string
  roleDescription: string | null
  workspaceCount: number
}

interface OnboardingFlowProps {
  userEmail: string
  invitationDetails: InvitationDetails | null
}

export function OnboardingFlow({ userEmail, invitationDetails }: OnboardingFlowProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // Zustand store for organic user flow
  const {
    organizationName,
    workspaceName,
    organizationId,
    currentStep,
    setOrganizationName,
    setWorkspaceName,
    setOrganizationId,
    nextStep,
    previousStep,
  } = useOnboardingStore()

  // Validation errors
  const [errors, setErrors] = useState<{ organizationName?: string; workspaceName?: string }>({})

  // Invitation acceptance flow
  const handleAcceptInvitation = async () => {
    if (!invitationDetails) return

    setIsLoading(true)
    try {
      const result = await acceptInvitation(invitationDetails.invitationId)

      if (result.success) {
        toast.success('Invitation accepted!', {
          description: `Welcome to ${invitationDetails.organizationName}`,
        })

        // Redirect based on workspace access
        if (invitationDetails.workspaceCount > 0) {
          // Redirect to organization page - user will see their workspaces
          router.push(`/organization/${invitationDetails.organizationId}`)
        } else {
          // No workspace access - redirect to settings
          router.push(`/organization/${invitationDetails.organizationId}/settings`)
        }
      } else {
        toast.error('Failed to accept invitation', {
          description: result.error || 'An unexpected error occurred',
        })
      }
    } catch (error) {
      console.error('Error accepting invitation:', error)
      toast.error('Failed to accept invitation', {
        description: 'An unexpected error occurred',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Organic user flow - Step 1: Create Organization
  const handleCreateOrganization = async () => {
    setErrors({})

    if (!organizationName.trim()) {
      setErrors({ organizationName: 'Organization name is required' })
      return
    }

    if (organizationName.trim().length > 100) {
      setErrors({ organizationName: 'Organization name must be less than 100 characters' })
      return
    }

    setIsLoading(true)
    try {
      const result = await createOrganizationWithPermissions(organizationName.trim())

      if (result.success && result.data) {
        setOrganizationId(result.data.id)
        toast.success('Organization created!', {
          description: `${result.data.name} is ready`,
        })
        nextStep()
      } else {
        toast.error('Failed to create organization', {
          description: result.error || 'An unexpected error occurred',
        })
      }
    } catch (error) {
      console.error('Error creating organization:', error)
      toast.error('Failed to create organization', {
        description: 'An unexpected error occurred',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Organic user flow - Step 2: Create Workspace
  const handleCreateWorkspace = async () => {
    setErrors({})

    if (!workspaceName.trim()) {
      setErrors({ workspaceName: 'Workspace name is required' })
      return
    }

    if (workspaceName.trim().length > 100) {
      setErrors({ workspaceName: 'Workspace name must be less than 100 characters' })
      return
    }

    if (!organizationId) {
      toast.error('No organization selected')
      return
    }

    setIsLoading(true)
    try {
      const result = await createWorkspaceWithPermissions(workspaceName.trim(), organizationId)

      if (result.success && result.data) {
        toast.success('Workspace created!', {
          description: `${result.data.name} is ready to use`,
        })

        // Redirect to the new workspace
        router.push(`/organization/${organizationId}/workspace/${result.data.id}`)
      } else {
        toast.error('Failed to create workspace', {
          description: result.error || 'An unexpected error occurred',
        })
      }
    } catch (error) {
      console.error('Error creating workspace:', error)
      toast.error('Failed to create workspace', {
        description: 'An unexpected error occurred',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Render invitation acceptance flow
  if (invitationDetails) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="h-6 w-6 text-primary" />
            <CardTitle>You've Been Invited!</CardTitle>
          </div>
          <CardDescription>Accept your invitation to get started</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Organization</span>
              <span className="font-medium">{invitationDetails.organizationName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Your Role</span>
              <Badge variant="secondary" className="capitalize">
                {invitationDetails.roleName}
              </Badge>
            </div>
            {invitationDetails.roleDescription && (
              <p className="text-sm text-muted-foreground">{invitationDetails.roleDescription}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Workspace Access</span>
              <span className="font-medium">
                {invitationDetails.workspaceCount} workspace{invitationDetails.workspaceCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {invitationDetails.workspaceCount === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No workspace access</AlertTitle>
              <AlertDescription>
                You don't have access to any workspaces yet. Contact your admin to get workspace access.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleAcceptInvitation} disabled={isLoading} className="w-full">
            {isLoading ? 'Accepting...' : 'Accept Invitation'}
            {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // Render organic user wizard flow
  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2">
        {[0, 1, 2].map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                step < currentStep
                  ? 'border-primary bg-primary text-primary-foreground'
                  : step === currentStep
                  ? 'border-primary bg-background text-primary'
                  : 'border-muted-foreground/30 bg-background text-muted-foreground'
              }`}
            >
              {step < currentStep ? <Check className="h-5 w-5" /> : <span>{step + 1}</span>}
            </div>
            {step < 2 && (
              <div
                className={`h-0.5 w-16 transition-colors ${
                  step < currentStep ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Welcome */}
      {currentStep === 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <CardTitle>Welcome to Your SaaS Platform!</CardTitle>
            </div>
            <CardDescription>Let's set up your workspace in just a few steps</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We'll help you create your organization and first workspace. This will only take a minute.
            </p>
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium">What you'll create:</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span>Your organization</span>
                </li>
                <li className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4" />
                  <span>Your first workspace</span>
                </li>
              </ul>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={nextStep} className="w-full">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 1: Create Organization */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-6 w-6 text-primary" />
              <CardTitle>Create Your Organization</CardTitle>
            </div>
            <CardDescription>This will be the top-level container for your workspaces</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organizationName">Organization Name</Label>
              <Input
                id="organizationName"
                placeholder="e.g., Acme Inc, My Company"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateOrganization()
                  }
                }}
                disabled={isLoading}
                className={errors.organizationName ? 'border-red-500' : ''}
              />
              {errors.organizationName && (
                <p className="text-sm text-red-500">{errors.organizationName}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={previousStep}
              disabled={isLoading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleCreateOrganization} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Continue'}
              {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Create Workspace */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <FolderKanban className="h-6 w-6 text-primary" />
              <CardTitle>Create Your First Workspace</CardTitle>
            </div>
            <CardDescription>Workspaces help you organize your projects and teams</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspaceName">Workspace Name</Label>
              <Input
                id="workspaceName"
                placeholder="e.g., Main, Development, Marketing"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateWorkspace()
                  }
                }}
                disabled={isLoading}
                className={errors.workspaceName ? 'border-red-500' : ''}
              />
              {errors.workspaceName && (
                <p className="text-sm text-red-500">{errors.workspaceName}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={previousStep}
              disabled={isLoading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleCreateWorkspace} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Complete Setup'}
              {!isLoading && <Check className="ml-2 h-4 w-4" />}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
