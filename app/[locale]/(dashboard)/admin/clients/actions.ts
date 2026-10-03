'use server'

import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { render } from '@react-email/render'
import { resend } from '@/lib/resend'
import { OrgApprovedEmail } from '@/emails/OrgApprovedEmail'
import { OrgRejectedEmail } from '@/emails/OrgRejectedEmail'
import { SupportAccessRequestEmail } from '@/emails/SupportAccessRequestEmail'

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
  /** Estado de la solicitud de acceso abierta del superadmin actual, si existe. */
  access: 'pending' | 'approved' | null
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

  const [{ data }, { data: { user } }] = await Promise.all([
    supabase
      .from('organization_members')
      .select('role, organizations(id, name, legal_name, status)')
      .eq('user_id', userId)
      .eq('active', true),
    supabase.auth.getUser(),
  ])

  const orgIds = (data ?? []).map((m) => m.organizations?.id).filter((id): id is string => !!id)
  const { data: requests } = orgIds.length && user
    ? await supabase
        .from('organization_access_requests')
        .select('organization_id, status')
        .eq('requested_by', user.id)
        .in('organization_id', orgIds)
        .in('status', ['pending', 'approved'])
    : { data: [] }

  const accessByOrg = new Map((requests ?? []).map((r) => [r.organization_id, r.status as 'pending' | 'approved']))

  return (data ?? []).map((m) => ({
    ...m,
    access: m.organizations ? accessByOrg.get(m.organizations.id) ?? null : null,
  })) as ClientOrgRow[]
}

/**
 * El personal de Aurali pide acceso a una organización. Los administradores
 * (permiso settings.manage) reciben la notificación en la app — la crea la
 * función SQL — y además un correo.
 */
export type AccessMode = 'access' | 'control'

/**
 * `control`: además de entrar, la pantalla de la organización sigue la del
 * superadmin (página, cursor, clics y scroll; ver lib/support/cobrowse.ts).
 * Ambos modos dan el mismo acceso.
 */
export async function requestOrganizationAccess(orgId: string, mode: AccessMode = 'access'): Promise<'pending' | 'approved'> {
  await requireSuperAdmin()
  const supabase = await createClient()

  if (mode !== 'access' && mode !== 'control') throw new Error('Modo de acceso no válido')
  const { data, error } = await supabase.rpc('request_org_access', { p_org_id: orgId, p_mode: mode })
  if (error) throw new Error(error.message)
  const result = data?.[0]
  if (!result) throw new Error('No se pudo crear la solicitud')

  if (result.created) {
    const [{ data: approvers }, { data: org }, { data: { user } }] = await Promise.all([
      supabase.rpc('org_access_approvers', { p_org_id: orgId }),
      supabase.from('organizations').select('name').eq('id', orgId).maybeSingle(),
      supabase.auth.getUser(),
    ])
    const { data: me } = user
      ? await supabase.from('profiles').select('firstname, lastname').eq('id', user.id).maybeSingle()
      : { data: null }

    const recipients = (approvers ?? []).map((a) => a.email).filter((email): email is string => !!email)
    if (recipients.length > 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const html = await render(
        SupportAccessRequestEmail({
          organizationName: org?.name ?? 'tu organización',
          staffName: [me?.firstname, me?.lastname].filter(Boolean).join(' ') || 'El equipo de Aurali',
          takeControl: mode === 'control',
          reviewUrl: `${appUrl}/es/analytics`,
        }) as React.ReactElement,
      )
      try {
        await resend.emails.send({
          from: 'Aurali <noreply@aurali.app>',
          to: recipients,
          subject: mode === 'control'
            ? 'El equipo de Aurali solicita acceso y control de tu cuenta'
            : 'El equipo de Aurali solicita acceso a tu cuenta',
          html,
        })
      } catch (err) {
        // La notificación dentro de la app ya quedó creada; el correo es un refuerzo.
        console.error('[requestOrganizationAccess] No se pudo enviar el correo', err)
      }
    }
  }

  revalidatePath('/[locale]/(dashboard)/admin/clients', 'page')
  return result.request_status as 'pending' | 'approved'
}

/**
 * Acceso aprobado al que el superadmin todavía no entró (p. ej. la aprobación
 * llegó mientras no tenía la app abierta). Se usa para ingresar automáticamente.
 */
export async function getApprovedAccessToEnter(): Promise<{ organizationId: string; organizationName: string | null } | null> {
  const profile = await requireSuperAdmin()
  const supabase = await createClient()

  const { data } = await supabase
    .from('organization_access_requests')
    .select('organization_id, decided_at, organizations(name)')
    .eq('requested_by', profile.id)
    .eq('status', 'approved')
    .order('decided_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data || data.organization_id === profile.current_organization_id) return null
  return { organizationId: data.organization_id, organizationName: data.organizations?.name ?? null }
}

export async function enterOrganizationAction(orgId: string) {
  const [supabase, profile] = await Promise.all([createClient(), requireSuperAdmin()])

  // La base rechaza el cambio si no hay acceso aprobado (o membresía propia).
  const { error } = await supabase
    .from('profiles')
    .update({ current_organization_id: orgId })
    .eq('id', profile.id)
  if (error) throw new Error(error.message)

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

  revalidatePath('/[locale]/(dashboard)/admin/clients', 'page')
}

export async function rejectOrganizationAction(orgId: string) {
  await requireSuperAdmin()
  const supabase = await createClient()

  const { data: org, error } = await supabase
    .from('organizations')
    .update({ status: 'rejected' })
    .eq('id', orgId)
    // Solo una solicitud pendiente: re-rechazar reenviaría el correo.
    .eq('status', 'pending')
    .select('name')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!org) throw new Error('La solicitud ya fue revisada')

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

  revalidatePath('/[locale]/(dashboard)/admin/clients', 'page')
}

export async function exitOrganizationAction() {
  const [supabase] = await Promise.all([createClient(), requireSuperAdmin()])

  // Sale de la organización y su acceso termina: volver exige otra aprobación.
  const { error } = await supabase.rpc('end_my_org_access')
  if (error) throw new Error(error.message)

  revalidatePath('/', 'layout')
  redirect('/admin/clients')
}
