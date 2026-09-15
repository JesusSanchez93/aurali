import { JSX } from 'react';
import { Control, FieldValues, Path } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../ui/form';
import { cn } from '@/lib/utils';

interface Props<T extends FieldValues> {
  control: Control<T>;
  disabled?: boolean;
  name: Path<T>;
  label: string;
  required?: boolean;
  options: { label: string; value: string }[];
  className?: string;
}

/** Grupo de opción única, sin dependencia de @radix-ui/react-radio-group
 *  (no instalada en el proyecto) — implementado sobre input[type=radio] nativo. */
export function FormRadioGroup<T extends FieldValues>({
  control,
  disabled,
  name,
  label,
  required,
  options,
  className,
}: Props<T>): JSX.Element {
  const groupId = name.replace('.', '-').toLowerCase();

  return (
    <div className={className}>
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem>
            {label && (
              <FormLabel className="text-sm font-medium">
                {label}
                {required && <span className="ml-0.5 text-red-500">*</span>}
              </FormLabel>
            )}
            <FormControl>
              <div className="flex flex-col gap-2 pt-1">
                {options.map((option) => (
                  <label
                    key={option.value}
                    htmlFor={`${groupId}-${option.value}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      id={`${groupId}-${option.value}`}
                      type="radio"
                      name={groupId}
                      value={option.value}
                      checked={field.value === option.value}
                      disabled={disabled}
                      onChange={() => field.onChange(option.value)}
                      className={cn(
                        'h-4 w-4 shrink-0 border-primary text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                      )}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
