import type { FormSection } from '@/lib/forms/types';
import { financialFraudSync } from './financialFraud';
import type { DomainSyncAdapter, DomainSyncContext } from './types';

// Registro explícito de adapters de sincronización legacy por dominio legal.
// El motor genérico de formularios (dynamic-actions.ts) nunca conoce estas
// claves directamente: sólo lee legal_process_form_schemas.domain_sync_key
// y delega aquí. Cualquier área legal nueva deja domain_sync_key en NULL y
// runDomainSync no hace nada — cero acoplamiento con el legacy financiero.
const DOMAIN_SYNC_ADAPTERS: Record<string, DomainSyncAdapter> = {
  financial_fraud: financialFraudSync,
};

export async function runDomainSync(
  domainSyncKey: string | null | undefined,
  section: FormSection,
  data: Record<string, unknown>,
  ctx: DomainSyncContext,
): Promise<void> {
  if (!domainSyncKey) return;

  const adapter = DOMAIN_SYNC_ADAPTERS[domainSyncKey];
  if (!adapter) return;

  await adapter(section, data, ctx);
}
