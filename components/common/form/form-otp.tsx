'use client';

import { Control, FieldValues, Path } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { REGEXP_ONLY_DIGITS } from 'input-otp';

interface Props<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  length?: number;
  required?: boolean;
  disabled?: boolean;
}

export function FormOtp<T extends FieldValues>({ control, name, label, length = 4, required, disabled }: Props<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm font-medium">
            {label}
            {required && <span className="ml-0.5 text-red-500">*</span>}
          </FormLabel>
          <FormControl>
            <InputOTP
              maxLength={length}
              pattern={REGEXP_ONLY_DIGITS}
              value={field.value ?? ''}
              onChange={field.onChange}
              disabled={disabled}
            >
              <InputOTPGroup>
                {Array.from({ length }).map((_, i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="h-12 w-12 text-lg"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
