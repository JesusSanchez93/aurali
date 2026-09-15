import type { SupabaseClient } from '@supabase/supabase-js';
import type { FormSection } from '@/lib/forms/types';

export interface DomainSyncContext {
  supabase: SupabaseClient;
  legalProcessId: string;
  organizationId: string;
}

export type DomainSyncAdapter = (
  section: FormSection,
  data: Record<string, unknown>,
  ctx: DomainSyncContext,
) => Promise<void>;
