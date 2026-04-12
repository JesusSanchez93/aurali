'use server';

import { revalidatePath } from 'next/cache';
import { getOrgAndUser } from '@/lib/server/get-org-user';

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


export async function createTemplate(input: { name: string; content: unknown; font_family?: string }) {
    const { supabase, organizationId } = await getOrgAndUser();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from('legal_templates')
        .insert({
            name: input.name,
            content: input.content,
            organization_id: organizationId,
            font_family: input.font_family ?? 'Inter',
        })
        .select('id')
        .single();

    if (error) throw new Error(error.message);
    revalidatePath('/', 'layout');
    return data;
}

export async function updateTemplate(id: string, input: { name: string; content: unknown; font_family?: string }) {
    const { supabase, organizationId } = await getOrgAndUser();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
        .from('legal_templates')
        .update({
            name: input.name,
            content: input.content,
            font_family: input.font_family ?? 'Inter',
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
