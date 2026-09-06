'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function getOrgContext() {
    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
        throw new Error('Unauthorized');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('current_organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.current_organization_id)
        throw new Error('Organization not found');

    return { supabase, userId: user.id, orgId: profile.current_organization_id };
}

export type ClientInput = {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    document_slug: string | null;
    document_number: string | null;
    address: string | null;
};

export type DocumentTypeOption = {
    slug: string;
    label: string;
};

export async function getClients(page: number = 1, pageSize: number = 10, search?: string) {
    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
        throw new Error('Unauthorized');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('current_organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.current_organization_id)
        throw new Error('Organization not found');

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .eq('organization_id', profile.current_organization_id);

    if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,document_number.ilike.%${search}%`);
    }

    const { data: clients, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) {
        throw new Error(error.message);
    }

    return { clients: clients || [], count: count || 0 };
}

export async function getClientDetail(id: string) {
    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
        throw new Error('Unauthorized');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('current_organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.current_organization_id)
        throw new Error('Organization not found');

    const { data: client, error } = await supabase
        .from('clients')
        .select('*')
        .eq('organization_id', profile.current_organization_id)
        .eq('id', id)
        .single();

    if (error) {
        throw new Error(error.message);
    }

    if (client) {
        if (client.document_front_image && !client.document_front_image.startsWith('http')) {
            const { data: frontData } = await supabase.storage
                .from('documents')
                .createSignedUrl(client.document_front_image, 3600);
            if (frontData) client.document_front_image = frontData.signedUrl;
        }

        if (client.document_back_image && !client.document_back_image.startsWith('http')) {
            const { data: backData } = await supabase.storage
                .from('documents')
                .createSignedUrl(client.document_back_image, 3600);
            if (backData) client.document_back_image = backData.signedUrl;
        }
    }

    return client;
}

export async function getActiveDocumentTypes(): Promise<DocumentTypeOption[]> {
    const { supabase, orgId } = await getOrgContext();

    const { data, error } = await supabase
        .from('documents')
        .select('slug, name')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('slug', { ascending: true });

    if (error) throw new Error(error.message);

    return (data || [])
        .filter((d): d is typeof d & { slug: string } => !!d.slug)
        .map((d) => {
            const name = d.name as { es?: string; en?: string } | null;
            return { slug: d.slug, label: name?.es || d.slug };
        });
}

export async function createClientRecord(input: ClientInput) {
    const { supabase, orgId, userId } = await getOrgContext();

    const { data, error } = await supabase
        .from('clients')
        .insert({
            organization_id: orgId,
            created_by: userId,
            first_name: input.first_name,
            last_name: input.last_name,
            email: input.email,
            phone: input.phone,
            document_slug: input.document_slug,
            document_number: input.document_number,
            address: input.address,
        })
        .select('id')
        .single();

    if (error) throw new Error(error.message);

    revalidatePath('/', 'layout');
    return data;
}

export async function updateClientRecord(id: string, input: ClientInput) {
    const { supabase, orgId } = await getOrgContext();

    const { error } = await supabase
        .from('clients')
        .update({
            first_name: input.first_name,
            last_name: input.last_name,
            email: input.email,
            phone: input.phone,
            document_slug: input.document_slug,
            document_number: input.document_number,
            address: input.address,
        })
        .eq('id', id)
        .eq('organization_id', orgId);

    if (error) throw new Error(error.message);

    revalidatePath('/', 'layout');
}
