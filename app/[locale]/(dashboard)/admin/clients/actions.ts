'use server'

import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

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

export async function getClientOrganizations(userId: string): Promise<ClientOrgRow[]> {
  await requireSuperAdmin()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organization_members')
    .select('role, organizations(id, name, legal_name, status)')
    .eq('user_id', userId)
    .eq('active', true)

    console.log({ data, error, userId });
    

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
