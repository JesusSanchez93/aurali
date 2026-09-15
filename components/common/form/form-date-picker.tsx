import { JSX } from 'react';
import { Control, FieldValues, Path } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../ui/form';
import { Input } from '../../ui/input';

interface Props<T extends FieldValues> {
  control: Control<T>;
  disabled?: boolean;
  name: Path<T>;
  label: string;
  required?: boolean;
  className?: string;
}

/** Selección de fecha; usa input[type=date] nativo (no hay dependencia de
 *  calendario instalada en el proyecto — mantiene el bundle sin agregar una). */
export function FormDatePicker<T extends FieldValues>({
  control,
  disabled,
  name,
  label,
  required,
  className,
}: Props<T>): JSX.Element {
  const id = name.replace('.', '-').toLowerCase();

  return (
    <div className={className}>
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem>
            {label && (
              <FormLabel htmlFor={id} className="text-sm font-medium">
                {label}
                {required && <span className="ml-0.5 text-red-500">*</span>}
              </FormLabel>
            )}
            <FormControl>
              <Input
                id={id}
                type="date"
                disabled={disabled}
                value={typeof field.value === 'string' ? field.value : ''}
                onChange={(e) => field.onChange(e.target.value)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
