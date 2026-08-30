import { redirect } from 'next/navigation'
import { ReactNode } from 'react'
import { getSessionProfile } from '@/lib/auth/get-session-profile'

interface Props {
  children: ReactNode
}

/**
 * Test doc gen layout — accessible only by SUPERADMIN or ORG_ADMIN, since it
 * generates real documents (with AI-resolved case data) for any of the
 * organization's recent processes and is meant for internal testing, not for
 * regular members.
 */
export default async function TestDocGenLayout({ children }: Props) {
  const { profile } = await getSessionProfile()

  if (!profile || (profile.system_role !== 'SUPERADMIN' && profile.org_role !== 'ORG_ADMIN')) {
    redirect('/analytics')
  }

  return <>{children}</>
}
