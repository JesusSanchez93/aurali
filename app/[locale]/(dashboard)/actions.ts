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

export type DashboardAnalytics = {
    kpis: {
        total: number;
        active: number;
        finished: number;
        archived: number;
        declined: number;
        conversionRate: number;
    };
    statusDistribution: { status: string; count: number }[];
    monthlyVolume: { month: string; label: string; count: number }[];
    topBanks: { bank: string; count: number }[];
    fraudFactors: { factor: string; count: number; pct: number }[];
};

const ACTIVE_STATUSES = new Set([
    'pending_client_data', 'completed', 'approved', 'paid',
    'documents_approved', 'documents_sent', 'documents_received',
]);

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) throw new Error('Unauthorized');

    const { data: profile } = await supabase
        .from('profiles')
        .select('current_organization_id, system_role')
        .eq('id', user.id)
        .single();

    const isSuperAdmin = profile?.system_role === 'SUPERADMIN';
    const orgId = profile?.current_organization_id;

    if (!isSuperAdmin && !orgId) throw new Error('Organization not found');

    if (!orgId) {
        return {
            kpis: { total: 0, active: 0, finished: 0, archived: 0, declined: 0, conversionRate: 0 },
            statusDistribution: [],
            monthlyVolume: [],
            topBanks: [],
            fraudFactors: [],
        };
    }

    // ── Fetch raw data ───────────────────────────────────────────────────────
    const [{ data: processes }, { data: banks }] = await Promise.all([
        supabase
            .from('legal_processes')
            .select('status, created_at')
            .eq('organization_id', orgId),
        supabase
            .from('legal_process_banks')
            .select('bank_name, file_complait, no_signal, bank_notification, access_website, access_link, used_to_operate_stolen_amount, lost_card')
            .eq('organization_id', orgId),
    ]);

    const allProcesses = processes ?? [];
    const allBanks = banks ?? [];

    // ── KPIs ────────────────────────────────────────────────────────────────
    const total = allProcesses.length;
    const finished = allProcesses.filter((p) => p.status === 'finished').length;
    const archived = allProcesses.filter((p) => p.status === 'archived').length;
    const declined = allProcesses.filter((p) => p.status === 'declined').length;
    const active = allProcesses.filter((p) => ACTIVE_STATUSES.has(p.status ?? '')).length;
    const conversionRate = total > 0 ? Math.round((finished / total) * 100) : 0;

    // ── Status distribution ──────────────────────────────────────────────────
    const statusMap: Record<string, number> = {};
    for (const p of allProcesses) {
        const s = p.status ?? 'draft';
        statusMap[s] = (statusMap[s] ?? 0) + 1;
    }
    const STATUS_ORDER = [
        'draft', 'pending_client_data', 'completed', 'approved', 'paid',
        'documents_approved', 'documents_sent', 'documents_received',
        'finished', 'archived', 'declined',
    ];
    const statusDistribution = STATUS_ORDER
        .filter((s) => statusMap[s])
        .map((s) => ({ status: s, count: statusMap[s] }));

    // ── Monthly volume — last 12 months ─────────────────────────────────────
    const now = new Date();
    const monthlyMap: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap[key] = 0;
    }
    for (const p of allProcesses) {
        if (!p.created_at) continue;
        const d = new Date(p.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (key in monthlyMap) monthlyMap[key]++;
    }
    const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthlyVolume = Object.entries(monthlyMap).map(([key, count]) => {
        const [year, month] = key.split('-');
        return { month: key, label: `${MONTHS_ES[parseInt(month) - 1]} ${year.slice(2)}`, count };
    });

    // ── Top banks ────────────────────────────────────────────────────────────
    const bankMap: Record<string, number> = {};
    for (const b of allBanks) {
        const name = b.bank_name ?? 'Desconocido';
        bankMap[name] = (bankMap[name] ?? 0) + 1;
    }
    const topBanks = Object.entries(bankMap)
        .map(([bank, count]) => ({ bank, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

    // ── Fraud factors ────────────────────────────────────────────────────────
    const total_banks = allBanks.length || 1;
    const factors: { factor: string; key: keyof typeof allBanks[0] }[] = [
        { factor: 'Denuncia policial', key: 'file_complait' },
        { factor: 'Sin señal', key: 'no_signal' },
        { factor: 'Notifc. del banco', key: 'bank_notification' },
        { factor: 'Accedió al sitio', key: 'access_website' },
        { factor: 'Link sospechoso', key: 'access_link' },
        { factor: 'Operó el monto', key: 'used_to_operate_stolen_amount' },
        { factor: 'Perdió la tarjeta', key: 'lost_card' },
    ];
    const fraudFactors = factors.map(({ factor, key }) => {
        const count = allBanks.filter((b) => b[key] === true).length;
        return { factor, count, pct: Math.round((count / total_banks) * 100) };
    }).sort((a, b) => b.count - a.count);

    return {
        kpis: { total, active, finished, archived, declined, conversionRate },
        statusDistribution,
        monthlyVolume,
        topBanks,
        fraudFactors,
    };
}
