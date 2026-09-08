'use server'

import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { render } from '@react-email/render'
import { resend } from '@/lib/resend'
import { OrgApprovedEmail } from '@/emails/OrgApprovedEmail'
import { OrgRejectedEmail } from '@/emails/OrgRejectedEmail'

export type ClientRow = {
  id: string
  firstname: string | null
  lastname: string | null
  email: string | null
  onboarding_status: string | null
  created_at: string
}

export type ClientOrgRow = {
  role: string
  organizations: {
    id: string
    name: string | null
    legal_name: string | null
    status: string | null
  } | null
}

export async function getAllClients(): Promise<ClientRow[]> {
  await requireSuperAdmin()
  const supabase = await createClient()

  const { data } = await supabase
    .from('profiles')
    .select('id, firstname, lastname, email, onboarding_status, created_at')
    .neq('system_role', 'SUPERADMIN')
    .order('created_at', { ascending: false })

  return (data ?? []) as ClientRow[]
}

export type PendingOrgRow = {
  id: string
  name: string | null
  legal_name: string | null
  legal_representative_name: string | null
  status: string | null
  created_at: string
  created_by_profile: { firstname: string | null; lastname: string | null; email: string | null } | null
}

export async function getPendingOrganizations(): Promise<PendingOrgRow[]> {
  await requireSuperAdmin()
  const supabase = await createClient()

  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, legal_name, legal_representative_name, status, created_at, created_by')
    .in('status', ['pending', 'rejected'])
    .order('created_at', { ascending: false })

  if (!orgs || orgs.length === 0) return []

  const creatorIds = orgs.map((o) => o.created_by).filter((id): id is string => !!id)
  const { data: profiles } = creatorIds.length
    ? await supabase.from('profiles').select('id, firstname, lastname, email').in('id', creatorIds)
    : { data: [] }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))

  return orgs.map((org) => ({
    id: org.id,
    name: org.name,
    legal_name: org.legal_name,
    legal_representative_name: org.legal_representative_name,
    status: org.status,
    created_at: org.created_at,
    created_by_profile: org.created_by ? profileById.get(org.created_by) ?? null : null,
  }))
}

export async function getClientOrganizations(userId: string): Promise<ClientOrgRow[]> {
  await requireSuperAdmin()
  const supabase = await createClient()

  const { data } = await supabase
    .from('organization_members')
    .select('role, organizations(id, name, legal_name, status)')
    .eq('user_id', userId)
    .eq('active', true)

  return (data ?? []) as ClientOrgRow[]
}

export async function enterOrganizationAction(orgId: string) {
  const supabase = await createClient()
  const profile = await requireSuperAdmin()

  await supabase
    .from('profiles')
    .update({ current_organization_id: orgId })
    .eq('id', profile.id)

  revalidatePath('/', 'layout')
  redirect('/analytics')
}

export async function approveOrganizationAction(orgId: string) {
  await requireSuperAdmin()
  const supabase = await createClient()

  const { data: org, error } = await supabase
    .from('organizations')
    .update({ status: 'active' })
    .eq('id', orgId)
    .select('name')
    .single()

  if (error) throw new Error(error.message)

  const { data: admins } = await supabase
    .from('organization_members')
    .select('profiles(email)')
    .eq('organization_id', orgId)
    .eq('role', 'ORG_ADMIN')
    .eq('active', true)

  const recipients = (admins ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((m: any) => m.profiles?.email)
    .filter((email: string | null | undefined): email is string => !!email)

  if (recipients.length > 0) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const html = await render(
      OrgApprovedEmail({
        companyName: org?.name ?? 'tu organización',
        loginUrl: `${appUrl}/es/auth/login`,
      }) as React.ReactElement,
    )

    await resend.emails.send({
      from: 'Aurali <noreply@aurali.app>',
      to: recipients,
      subject: 'Tu cuenta en Aurali fue aprobada',
      html,
    })
  }

  revalidatePath('/admin/clients')
}

export async function rejectOrganizationAction(orgId: string) {
  await requireSuperAdmin()
  const supabase = await createClient()

  const { data: org, error } = await supabase
    .from('organizations')
    .update({ status: 'rejected' })
    .eq('id', orgId)
    .select('name')
    .single()

  if (error) throw new Error(error.message)

  const { data: admins } = await supabase
    .from('organization_members')
    .select('profiles(email)')
    .eq('organization_id', orgId)
    .eq('role', 'ORG_ADMIN')
    .eq('active', true)

  const recipients = (admins ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((m: any) => m.profiles?.email)
    .filter((email: string | null | undefined): email is string => !!email)

  if (recipients.length > 0) {
    const html = await render(
      OrgRejectedEmail({
        companyName: org?.name ?? 'tu organización',
      }) as React.ReactElement,
    )

    await resend.emails.send({
      from: 'Aurali <noreply@aurali.app>',
      to: recipients,
      subject: 'Estado de tu solicitud en Aurali',
      html,
    })
  }

  revalidatePath('/admin/clients')
}

export async function exitOrganizationAction() {
  const supabase = await createClient()
  const profile = await requireSuperAdmin()

  await supabase
    .from('profiles')
    .update({ current_organization_id: null })
    .eq('id', profile.id)

  revalidatePath('/', 'layout')
  redirect('/admin/clients')
}
