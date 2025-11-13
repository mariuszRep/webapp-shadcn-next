import { notFound } from 'next/navigation'
import { ReactNode } from 'react'

interface OrganizationLayoutProps {
  children: ReactNode
  params: Promise<{ organizationId: string }>
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function OrganizationLayout({
  children,
  params,
}: OrganizationLayoutProps) {
  const { organizationId } = await params

  // Validate UUID format
  if (!UUID_REGEX.test(organizationId)) {
    notFound()
  }

  return <>{children}</>
}
