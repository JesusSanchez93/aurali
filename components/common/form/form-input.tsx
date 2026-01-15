import { JSX } from 'react';
import { Control, FieldValues, Path } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../ui/form';
import { Input } from '../../ui/input';
import { PhoneInput } from './phone-input';

interface Props<T extends FieldValues> {
  control: Control<T>;
  disabled?: boolean;
  name: Path<T>;
  label: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  type?: 'text' | 'number' | 'email' | 'phone';
  description?: string;
}

export function FormInput<T extends FieldValues>({
  control,
  disabled,
  name,
  label,
  placeholder,
  required,
  className,
  description,
  type = 'text',
}: Props<T>): JSX.Element {
  const id = name.replace('.', '-').toLowerCase();
  return (
    <div className={className}>
      <FormField
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel htmlFor={id} className="text-sm font-medium">
              {label}
              {required && <span className="ml-0.5 text-red-500">*</span>}
            </FormLabel>
            <FormControl>
              {type === 'phone' ? (
                <PhoneInput
                  international
                  {...field}
                  disabled={disabled}
                  aria-invalid={fieldState.error ? true : undefined}
                  placeholder={placeholder}
                />
              ) : (
                <Input
                  {...field}
                  id={id}
                  disabled={disabled}
                  aria-invalid={fieldState.error ? true : undefined}
                  placeholder={placeholder}
                  type={type}
                />
              )}
            </FormControl>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
