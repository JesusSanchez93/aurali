'use server';

import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/authorization';

export interface PaymentOverviewRow {
  legalProcessId: string;
  processNumber: number | null;
  status: string | null;
  clientName: string;
  clientEmail: string | null;
  feeTotal: number | null;
  currency: string;
  paidAmount: number;
}

/**
 * Honorarios y pagos de todos los procesos de la organización, en un solo
 * listado independiente de abrir cada proceso — el registro de pagos vive
 * acá, no en el detalle del proceso legal (ver process-payments-section.tsx,
 * reutilizado desde el Sheet de gestión de esta página).
 */
export async function getPaymentsOverview(
  page: number = 1,
  pageSize: number = 10,
  search?: string,
): Promise<{ rows: PaymentOverviewRow[]; count: number }> {
  await requirePermission('payments.view');
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.current_organization_id) throw new Error('Organization not found');
  const organizationId = profile.current_organization_id;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('legal_processes')
    .select('id, process_number, status, form_schema_id, legal_process_clients!inner (first_name, last_name, email, document_number)', { count: 'exact' })
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (search) {
    const rawSearch = search.startsWith('#') ? search.slice(1) : search;
    const isNumeric = /^\d+$/.test(rawSearch.trim());

    if (isNumeric) {
      const processNum = parseInt(rawSearch.trim(), 10);
      query = Number.isFinite(processNum)
        ? query.eq('process_number', processNum)
        : query.eq('process_number', -1);
    } else {
      query = query.or(
        `first_name.ilike.%${search}%,` +
        `last_name.ilike.%${search}%,` +
        `email.ilike.%${search}%,` +
        `document_number.ilike.%${search}%`,
        { referencedTable: 'legal_process_clients' },
      );
    }
  }

  const { data: processes, count, error } = await query.range(from, to);
  if (error) throw new Error(error.message);

  const processIds = (processes ?? []).map((p) => p.id);

  // legal_process_clients.first_name/last_name solo se llenan hoy desde el
  // formulario legado — un proceso con formulario dinámico (DFB) guarda el
  // nombre en legal_process_form_responses (mismo fallback que
  // getLegalProcesses, ver legal-process/actions.ts).
  const namesByProcessId = new Map<string, { first_name?: string; last_name?: string }>();
  const missingNameIds = (processes ?? [])
    .filter((p) => {
      const client = (p.legal_process_clients as unknown as { first_name: string | null; last_name: string | null }[])[0] ?? null;
      return p.form_schema_id && !client?.first_name && !client?.last_name;
    })
    .map((p) => p.id);

  if (missingNameIds.length > 0) {
    const { data: responseRows } = await supabase
      .from('legal_process_form_responses')
      .select('legal_process_id, data')
      .in('legal_process_id', missingNameIds);

    for (const row of responseRows ?? []) {
      const data = row.data as Record<string, unknown>;
      const firstName = data.nombres ?? data.first_name ?? data.CLIENT__FIRST_NAME;
      const lastName = data.apellidos ?? data.last_name ?? data.CLIENT__LAST_NAME;
      const existing = namesByProcessId.get(row.legal_process_id) ?? {};
      if (typeof firstName === 'string' && firstName) existing.first_name = firstName;
      if (typeof lastName === 'string' && lastName) existing.last_name = lastName;
      namesByProcessId.set(row.legal_process_id, existing);
    }
  }

  const [{ data: fees }, { data: payments }] = await Promise.all([
    processIds.length
      ? supabase.from('legal_process_fees').select('legal_process_id, total_amount, currency').in('legal_process_id', processIds)
      : Promise.resolve({ data: [] as { legal_process_id: string; total_amount: number; currency: string }[] }),
    processIds.length
      ? supabase.from('legal_process_payments').select('legal_process_id, amount').in('legal_process_id', processIds)
      : Promise.resolve({ data: [] as { legal_process_id: string; amount: number }[] }),
  ]);

  const feeByProcess = new Map((fees ?? []).map((f) => [f.legal_process_id, f]));
  const paidByProcess = new Map<string, number>();
  for (const p of payments ?? []) {
    paidByProcess.set(p.legal_process_id, (paidByProcess.get(p.legal_process_id) ?? 0) + Number(p.amount));
  }

  const rows: PaymentOverviewRow[] = (processes ?? []).map((p) => {
    const client = (p.legal_process_clients as unknown as { first_name: string | null; last_name: string | null; email: string | null }[])[0] ?? null;
    const fallbackNames = namesByProcessId.get(p.id);
    const firstName = client?.first_name || fallbackNames?.first_name;
    const lastName = client?.last_name || fallbackNames?.last_name;
    const fee = feeByProcess.get(p.id);
    return {
      legalProcessId: p.id,
      processNumber: p.process_number,
      status: p.status,
      clientName: [firstName, lastName].filter(Boolean).join(' ') || '—',
      clientEmail: client?.email ?? null,
      feeTotal: fee ? Number(fee.total_amount) : null,
      currency: fee?.currency ?? 'COP',
      paidAmount: paidByProcess.get(p.id) ?? 0,
    };
  });

  return { rows, count: count ?? 0 };
}
