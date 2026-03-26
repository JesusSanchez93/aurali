/**
 * Document template registry.
 *
 * Each entry here can be seeded into the `document_templates` table via
 * `seedDefaultTemplates(organizationId)` — useful during org onboarding.
 */

export interface TemplateVariable {
  name: string;
  label: string;
  required: boolean;
}

export interface DocumentTemplateDefinition {
  name: string;
  /** Matches the `type` column in document_templates */
  type: 'power_of_attorney' | 'legal_contract' | string;
  variables: TemplateVariable[];
  /** Full HTML body (without the outer page wrapper) */
  html_template: string;
}

export { POWER_OF_ATTORNEY } from './powerOfAttorney';
export { LEGAL_CONTRACT }    from './legalContract';

/** All built-in templates indexed by type for quick lookup */
import { POWER_OF_ATTORNEY } from './powerOfAttorney';
import { LEGAL_CONTRACT }    from './legalContract';

export const DEFAULT_TEMPLATES: Record<string, DocumentTemplateDefinition> = {
  power_of_attorney: POWER_OF_ATTORNEY,
  legal_contract:    LEGAL_CONTRACT,
};
