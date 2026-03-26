import { redirect } from 'next/navigation'
import { ReactNode } from 'react'
import { getSessionProfile } from '@/lib/auth/get-session-profile'

interface Props {
  children: ReactNode
}

/**
 * Admin section layout — accessible only by SUPERADMIN.
 * Non-SUPERADMIN users are redirected to the dashboard.
 */
export default async function AdminLayout({ children }: Props) {
  const { profile } = await getSessionProfile()

  if (!profile || profile.system_role !== 'SUPERADMIN') {
    redirect('/dashboard')
  }

  return <>{children}</>
}
