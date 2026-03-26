'use server';

import { createClient } from '@/lib/supabase/server';

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
