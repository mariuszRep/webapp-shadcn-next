'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getOrganizationInvitations, type InvitationWithDetails } from '@/lib/actions/invitation-actions'
import { InvitationsTable } from '@/components/invitations-table'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

interface InvitationsManagerProps {
  organizationId: string
}

export function InvitationsManager({ organizationId }: InvitationsManagerProps) {
  const router = useRouter()
  const [invitations, setInvitations] = useState<InvitationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadInvitations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  async function loadInvitations() {
    try {
      setLoading(true)
      setError(null)

      const result = await getOrganizationInvitations(organizationId)

      if (result.success && result.data) {
        setInvitations(result.data)
      } else {
        setError(result.error || 'Failed to load invitations')
      }
    } catch (err) {
      console.error('Error loading invitations:', err)
      setError('Failed to load invitations')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return <InvitationsTable organizationId={organizationId} invitations={invitations} />
}
