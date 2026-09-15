import { VARIABLE_GROUPS } from '@/app/[locale]/(dashboard)/settings/document-templates/_components/variables';

const ALLOWED_GROUPS = new Set(['client', 'banking']);

export interface FormVariableOption {
  /** Valor real guardado en FormFieldSchema.key — usa "__" en vez de "." porque
   *  react-hook-form interpreta un punto en el name de un campo como un path
   *  anidado (ver documentVariableKeys.ts caller sites). */
  key: string;
  /** Token tal como se usa en los templates de documentos, ej. "CLIENT.FIRST_NAME" — solo para mostrar. */
  token: string;
  label: string;
  groupLabel: string;
}

/** Vocabulario de keys que puede tomar un campo del Dynamic Form Builder — un
 *  subconjunto de VARIABLE_GROUPS (solo Cliente y Banco: lo demás se resuelve
 *  automáticamente y no tiene sentido que el cliente lo "responda" en un
 *  formulario). Ver lib/forms/documentVariableKeys.ts en el plan de DFB. */
export const FORM_VARIABLE_OPTIONS: FormVariableOption[] = VARIABLE_GROUPS
  .filter((g) => ALLOWED_GROUPS.has(g.key))
  .flatMap((g) =>
    g.variables.map((v) => ({
      key: `${g.key.toUpperCase()}__${v.key}`,
      token: `${g.key.toUpperCase()}.${v.key}`,
      label: v.label,
      groupLabel: g.label,
    })),
  );
