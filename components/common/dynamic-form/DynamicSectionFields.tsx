import type { Control, FieldValues } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import type { FormFieldSchema } from '@/lib/forms/types';
import { isFieldVisible } from '@/lib/forms/fieldVisibility';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';

interface Props<T extends FieldValues> {
  control: Control<T>;
  fields: FormFieldSchema[];
  disabled?: boolean;
  /** Necesario para que el campo de audio (FormAudioTranscription) pueda
   *  resolver la organización y aplicar el tope de uso de IA — ausente en la
   *  vista previa del form-builder (no hay proceso real). */
  legalProcessId?: string;
}

/** Arma una sección de formulario dinámico como grid mobile-first: en mobile
 *  (sin prefijo) todo campo ocupa 100%; desde `sm:` hacia arriba, un campo
 *  `width: 'half'` ocupa una columna y uno `'full'` ocupa las dos. También
 *  filtra campos según `dependsOn` con el helper compartido. */
export function DynamicSectionFields<T extends FieldValues>({ control, fields, disabled, legalProcessId }: Props<T>) {
  const values = useWatch({ control }) as Record<string, unknown>;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields
        .filter((field) => isFieldVisible(field.dependsOn, values))
        .map((field) => {
          // financial_product siempre ocupa el ancho completo — su contenido
          // (tarjetas de producto con varios selects) es demasiado ancho para
          // convivir en una columna de 'half'.
          const isHalf = field.width === 'half' && field.type !== 'financial_product';
          return (
            <div key={field.key} className={isHalf ? 'sm:col-span-1' : 'col-span-1 sm:col-span-2'}>
              <DynamicFieldRenderer control={control} field={field} disabled={disabled} legalProcessId={legalProcessId} />
            </div>
          );
        })}
    </div>
  );
}
