import { JSX } from 'react';
import { Control, FieldValues, Path } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';

interface Props<T extends FieldValues> {
  control: Control<T>;
  disabled: boolean;
  name: Path<T>;
  label: string;
  placeholder?: string;
  required?: boolean;
  options: { label: string; value: string; key?: string }[];
  className?: string;
}

export function FormSelect<T extends FieldValues>({
  control,
  disabled,
  name,
  label,
  placeholder,
  required,
  options,
  className,
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
              <Select {...field} disabled={disabled}>
                <SelectTrigger
                  id={id}
                  className={
                    fieldState.error ? 'border-red-500 focus:ring-red-500' : ''
                  }
                >
                  <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem
                      key={option?.key || option.value}
                      value={option.value}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
