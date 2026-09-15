import { JSX } from 'react';
import { Control, FieldValues, Path } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../ui/form';
import { Checkbox } from '../../ui/checkbox';

interface Props<T extends FieldValues> {
  control: Control<T>;
  disabled?: boolean;
  name: Path<T>;
  label: string;
  required?: boolean;
  options: { label: string; value: string }[];
  className?: string;
}

/** Grupo de checkboxes controlado por RHF; el valor del campo es string[]. */
export function FormCheckboxGroup<T extends FieldValues>({
  control,
  disabled,
  name,
  label,
  required,
  options,
  className,
}: Props<T>): JSX.Element {
  return (
    <div className={className}>
      <FormField
        control={control}
        name={name}
        render={({ field }) => {
          const current: string[] = Array.isArray(field.value) ? field.value : [];
          return (
            <FormItem>
              {label && (
                <FormLabel className="text-sm font-medium">
                  {label}
                  {required && <span className="ml-0.5 text-red-500">*</span>}
                </FormLabel>
              )}
              <FormControl>
                <div className="flex flex-col gap-2 pt-1">
                  {options.map((option) => {
                    const checked = current.includes(option.value);
                    return (
                      <label key={option.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(value) => {
                            const next = value
                              ? [...current, option.value]
                              : current.filter((v) => v !== option.value);
                            field.onChange(next);
                          }}
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }}
      />
    </div>
  );
}
