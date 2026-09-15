import type { Control, FieldValues, Path } from 'react-hook-form';
import type { FormFieldSchema } from '@/lib/forms/types';
import { FormInput } from '@/components/common/form/form-input';
import { FormTextarea } from '@/components/common/form/form-textarea';
import { FormSelect } from '@/components/common/form/form-select';
import { FormCombobox } from '@/components/common/form/form-combobox';
import { FormSwitch } from '@/components/common/form/form-switch';
import { FormFileUpload } from '@/components/common/form/form-file-upload';
import { FormImageUpload } from '@/components/common/form/form-image-upload';
import { FormCheckboxGroup } from '@/components/common/form/form-checkbox-group';
import { FormRadioGroup } from '@/components/common/form/form-radio-group';
import { FormDatePicker } from '@/components/common/form/form-date-picker';
import { FormAudioTranscription } from '@/components/common/form/form-audio-transcription';
import { FormFinancialProduct } from '@/components/common/form/form-financial-product';

interface Props<T extends FieldValues> {
  control: Control<T>;
  field: FormFieldSchema;
  disabled?: boolean;
}

/** Switch-case declarativo que renderiza un FormFieldSchema con el componente
 *  común correspondiente — mismo patrón que renderFieldControl en
 *  components/app/workflow-editor/NodeConfigPanel.tsx, pero para el vocabulario
 *  de campos de formulario de cliente (lib/forms/types.ts). Compartido entre la
 *  vista previa del builder (admin/form-builder/[id]) y el renderer
 *  público del cliente. */
export function DynamicFieldRenderer<T extends FieldValues>({ control, field, disabled }: Props<T>) {
  const name = field.key as Path<T>;
  const required = field.validation?.required;
  const options = field.options ?? [];

  switch (field.type) {
    case 'textarea':
      return (
        <FormTextarea control={control} name={name} label={field.label} required={required} disabled={disabled} placeholder={field.placeholder} description={field.helpText} />
      );
    case 'select':
      // Selects respaldados por un catálogo global (bancos, tipos de documento)
      // pueden tener decenas de opciones — usan un combobox con buscador en vez
      // del select simple usado para opciones escritas a mano.
      return field.optionsSource ? (
        <FormCombobox control={control} name={name} label={field.label} required={required} disabled={disabled} placeholder={field.placeholder} options={options} />
      ) : (
        <FormSelect control={control} name={name} label={field.label} required={required} disabled={disabled} placeholder={field.placeholder} options={options} />
      );
    case 'switch':
      return <FormSwitch control={control} name={name} label={field.label} required={required} disabled={disabled} description={field.helpText} />;
    case 'number':
      return (
        <FormInput control={control} name={name} label={field.label} required={required} disabled={disabled} placeholder={field.placeholder} type="number" description={field.helpText} />
      );
    case 'phone':
      return (
        <FormInput control={control} name={name} label={field.label} required={required} disabled={disabled} placeholder={field.placeholder} type="phone" description={field.helpText} />
      );
    case 'date':
      return <FormDatePicker control={control} name={name} label={field.label} required={required} disabled={disabled} />;
    case 'checkbox_group':
      return <FormCheckboxGroup control={control} name={name} label={field.label} required={required} disabled={disabled} options={options} />;
    case 'radio':
      return <FormRadioGroup control={control} name={name} label={field.label} required={required} disabled={disabled} options={options} />;
    case 'file_upload':
      return (
        <FormFileUpload control={control} name={name} label={field.label} required={required} disabled={disabled} accept={field.accept} maxFiles={field.maxFiles} multiple={(field.maxFiles ?? 1) > 1} description={field.helpText} />
      );
    case 'image_upload':
      return <FormImageUpload control={control} name={name} label={field.label} required={required} disabled={disabled} description={field.helpText} />;
    case 'audio_transcription':
      return <FormAudioTranscription control={control} name={name} label={field.label} required={required} disabled={disabled} />;
    case 'financial_product':
      return <FormFinancialProduct control={control} name={name} label={field.label} required={required} disabled={disabled} />;
    case 'text':
    default:
      return (
        <FormInput control={control} name={name} label={field.label} required={required} disabled={disabled} placeholder={field.placeholder} type="text" description={field.helpText} />
      );
  }
}
