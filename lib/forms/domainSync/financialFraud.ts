import { summarizeLast4Digits } from '@/lib/forms/financialProduct';
import type { FinancialProductValue } from '@/lib/forms/types';
import type { DomainSyncAdapter } from './types';

// Sincronización legacy del flujo "Fraudes Financieros": mientras
// buildDocumentTemplateData/executeGenerateDocument (lib/workflow/nodeExecutors.ts)
// sólo lean legal_process_clients/legal_process_banks (nunca
// legal_process_form_responses), cualquier formulario dinámico marcado con
// domain_sync_key = 'financial_fraud' debe reflejar aquí los mismos campos
// que el flujo legado hardcodeado (app/.../[step]/actions.ts). No se activa
// para ningún otro dominio legal: runDomainSync es no-op si domain_sync_key
// es NULL.
export const financialFraudSync: DomainSyncAdapter = async (section, data, ctx) => {
  const { supabase, legalProcessId, organizationId } = ctx;

  const firstName = data.nombres ?? data.first_name ?? data.CLIENT__FIRST_NAME;
  const lastName = data.apellidos ?? data.last_name ?? data.CLIENT__LAST_NAME;

  const documentField = section.fields.find((f) => f.optionsSource === 'catalog_documents');
  const documentId = documentField ? data[documentField.key] : undefined;

  const clientUpdate: Record<string, string> = {};
  if (typeof firstName === 'string') clientUpdate.first_name = firstName;
  if (typeof lastName === 'string') clientUpdate.last_name = lastName;

  if (typeof documentId === 'string' && documentId) {
    const { data: documentRow } = await supabase
      .from('documents')
      .select('slug, name')
      .eq('id', documentId)
      .eq('organization_id', organizationId)
      .single();

    if (documentRow) {
      clientUpdate.document_id = documentId;
      clientUpdate.document_slug = documentRow.slug ?? '';
      clientUpdate.document_name = (documentRow.name as { es?: string } | null)?.es ?? documentRow.slug ?? '';
    }
  }

  if (Object.keys(clientUpdate).length > 0) {
    await supabase.from('legal_process_clients').update(clientUpdate).eq('legal_process_id', legalProcessId);
  }

  const bankField = section.fields.find((f) => f.optionsSource === 'catalog_banks');
  const bankId = bankField ? data[bankField.key] : undefined;
  const products = data.BANKING__PRODUCTS;
  const fraudSummary = data.BANKING__FRAUD_INCIDENT_SUMMARY;

  const bankingUpdate: Record<string, unknown> = {};

  if (typeof bankId === 'string' && bankId) {
    const { data: bankRow } = await supabase
      .from('banks')
      .select('id, name, slug')
      .eq('id', bankId)
      .eq('organization_id', organizationId)
      .single();

    if (bankRow) {
      bankingUpdate.bank_id = bankRow.id;
      bankingUpdate.bank_name = bankRow.name;
      bankingUpdate.bank_slug = bankRow.slug;
    }
  }

  if (Array.isArray(products)) {
    bankingUpdate.products = products;
    bankingUpdate.last_4_digits = summarizeLast4Digits(products as FinancialProductValue[]);
  }

  if (typeof fraudSummary === 'string') {
    bankingUpdate.fraud_incident_summary = fraudSummary;
  }

  if (Object.keys(bankingUpdate).length === 0) return;

  const { data: existingBank } = await supabase
    .from('legal_process_banks')
    .select('id')
    .eq('legal_process_id', legalProcessId)
    .maybeSingle();

  if (existingBank) {
    await supabase.from('legal_process_banks').update(bankingUpdate).eq('id', existingBank.id);
  } else {
    await supabase.from('legal_process_banks').insert({
      ...bankingUpdate,
      legal_process_id: legalProcessId,
      organization_id: organizationId,
    });
  }
};
