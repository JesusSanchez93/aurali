/** Condición de visibilidad compartida entre el vocabulario de nodos de workflow
 *  (ConfigField.dependsOn en components/app/workflow-editor/node-config.ts) y el
 *  vocabulario de campos de formulario dinámico (FormFieldSchema.dependsOn en
 *  lib/forms/types.ts) — ambos tienen la misma forma `{ key, value }` a propósito. */
export interface FieldDependsOnCondition {
  key: string;
  value: boolean | string | string[];
}

/** Evalúa si un campo debe mostrarse dado el estado actual de valores del formulario.
 *  Un campo sin `dependsOn` siempre es visible. Con `dependsOn`, TODAS las condiciones
 *  deben cumplirse (AND) — switches comparan booleanos, selects/inputs de texto
 *  comparan su valor actual como string, y un array de valores actúa como "uno de". */
export function isFieldVisible(
  dependsOn: FieldDependsOnCondition[] | undefined,
  values: Record<string, unknown>,
): boolean {
  if (!dependsOn) return true;
  return dependsOn.every(({ key, value }) => {
    const current = values[key];
    if (Array.isArray(value)) return value.includes(String(current));
    if (typeof value === 'boolean') return current === value;
    return String(current) === value;
  });
}
