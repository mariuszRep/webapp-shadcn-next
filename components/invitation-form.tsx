'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { sendInvitation } from '@/lib/actions/invitation-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'
import { ArrowLeft, Send } from 'lucide-react'

const invitationSchema = z.object({
  email: z.string().email('Invalid email format'),
  orgRoleId: z.string().uuid('Please select a role'),
})

interface Role {
  id: string
  name: string
  description: string | null
}

interface InvitationFormProps {
  organizationId: string
  organizationName: string
  roles: Role[]
}

export function InvitationForm({ organizationId, organizationName, roles }: InvitationFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [orgRoleId, setOrgRoleId] = useState('')
  const [errors, setErrors] = useState<{ email?: string; orgRoleId?: string }>({})
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    // Validate form
    const validation = invitationSchema.safeParse({ email, orgRoleId })
    if (!validation.success) {
      const fieldErrors: { email?: string; orgRoleId?: string } = {}
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as 'email' | 'orgRoleId'
        fieldErrors[field] = issue.message
      })
      setErrors(fieldErrors)
      return
    }

    setIsLoading(true)

    try {
      const result = await sendInvitation({
        email,
        orgRoleId,
        orgId: organizationId,
      })

      if (result.success && result.data) {
        // Show different message for existing vs new users
        if (result.data.isExistingUser) {
          toast.success('Invitation sent to existing user!', {
            description: `${email} has been sent a magic link to access this organization.`,
          })
        } else {
          toast.success('Invitation sent successfully!', {
            description: `An invitation email has been sent to ${email}`,
          })
        }

        // Redirect to workspace permissions page
        router.push(
          `/organization/${organizationId}/settings/invitations/${result.data.userId}/workspaces`
        )
      } else {
        toast.error('Failed to send invitation', {
          description: result.error || 'An unexpected error occurred',
        })
      }
    } catch (error) {
      console.error('Error sending invitation:', error)
      toast.error('Failed to send invitation', {
        description: 'An unexpected error occurred',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>User Details</CardTitle>
          <CardDescription>
            Enter the email address and role for the new user
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Organization Role</Label>
            <Select
              value={orgRoleId}
              onValueChange={setOrgRoleId}
              disabled={isLoading}
            >
              <SelectTrigger
                id="role"
                className={errors.orgRoleId ? 'border-red-500' : ''}
              >
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    <div className="flex flex-col">
                      <span className="font-medium capitalize">{role.name}</span>
                      {role.description && (
                        <span className="text-xs text-muted-foreground">
                          {role.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.orgRoleId && (
              <p className="text-sm text-red-500">{errors.orgRoleId}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/organization/${organizationId}/settings/invitations`)}
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="mr-2">Sending...</span>
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Invitation
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
