'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function getOrgAndUser() {
    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) throw new Error('Unauthorized');

    const { data: profile } = await supabase
        .from('profiles')
        .select('current_organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.current_organization_id) throw new Error('Organization not found');

    return { supabase, userId: user.id, organizationId: profile.current_organization_id };
}

export async function getTemplates() {
    const { supabase, organizationId } = await getOrgAndUser();

    const { data, error } = await supabase
        .from('legal_templates')
        .select('id, name, version, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
}

export async function getTemplate(id: string) {
    const { supabase, organizationId } = await getOrgAndUser();

    const { data, error } = await supabase
        .from('legal_templates')
        .select('*')
        .eq('id', id)
        .eq('organization_id', organizationId)
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function getDocHeaders() {
    const { supabase, organizationId } = await getOrgAndUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
        .from('document_headers')
        .select('id, name, is_default, content')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
    return (data ?? []) as { id: string; name: string; is_default: boolean; content: unknown }[];
}

export async function getDocFooters() {
    const { supabase, organizationId } = await getOrgAndUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
        .from('document_footers')
        .select('id, name, is_default, content')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
    return (data ?? []) as { id: string; name: string; is_default: boolean; content: unknown }[];
}

export async function createTemplate(input: { name: string; content: unknown; header_id?: string | null; footer_id?: string | null }) {
    const { supabase, organizationId } = await getOrgAndUser();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from('legal_templates')
        .insert({
            name: input.name,
            content: input.content,
            organization_id: organizationId,
            header_id: input.header_id ?? null,
            footer_id: input.footer_id ?? null,
        })
        .select('id')
        .single();

    if (error) throw new Error(error.message);
    revalidatePath('/', 'layout');
    return data;
}

export async function updateTemplate(id: string, input: { name: string; content: unknown; header_id?: string | null; footer_id?: string | null }) {
    const { supabase, organizationId } = await getOrgAndUser();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
        .from('legal_templates')
        .update({
            name: input.name,
            content: input.content,
            header_id: input.header_id ?? null,
            footer_id: input.footer_id ?? null,
        })
        .eq('id', id)
        .eq('organization_id', organizationId);

    if (error) throw new Error(error.message);
    revalidatePath('/', 'layout');
}

export async function deleteTemplate(id: string) {
    const { supabase, organizationId } = await getOrgAndUser();

    const { error } = await supabase
        .from('legal_templates')
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId);

    if (error) throw new Error(error.message);
    revalidatePath('/', 'layout');
}
