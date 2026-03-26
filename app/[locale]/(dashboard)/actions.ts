'use server';

import { createClient } from '@/lib/supabase/server';

export async function getDashboardStats() {
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
        .select('current_organization_id, system_role')
        .eq('id', user.id)
        .single();

    const isSuperAdmin = profile?.system_role === 'SUPERADMIN';
    const orgId = profile?.current_organization_id;

    if (!isSuperAdmin && !orgId)
        throw new Error('Organization not found');

    const base = (table: 'clients' | 'legal_processes') =>
        supabase.from(table).select('*', { count: 'exact', head: true });

    const withOrg = (table: 'clients' | 'legal_processes') =>
        orgId ? base(table).eq('organization_id', orgId) : base(table);

    const { count: totalClients } = await withOrg('clients');

    const { count: totalProcesses } = await withOrg('legal_processes');

    const completedQuery = orgId
        ? base('legal_processes').eq('organization_id', orgId).eq('status', 'finished')
        : base('legal_processes').eq('status', 'finished');
    const { count: completedProcesses } = await completedQuery;

    return {
        totalClients: totalClients || 0,
        totalProcesses: totalProcesses || 0,
        completedProcesses: completedProcesses || 0,
    };
}
