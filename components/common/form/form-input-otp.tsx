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
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/ui/input-otp';

interface Props<T extends FieldValues> {
    control: Control<T>;
    disabled?: boolean;
    name: Path<T>;
    label: string;
    required?: boolean;
    className?: string; // For the outer wrapper
    description?: string;
    maxLength: number;
}

export function FormInputOtp<T extends FieldValues>({
    control,
    disabled,
    name,
    label,
    required,
    className,
    description,
    maxLength,
}: Props<T>): JSX.Element {
    const id = name.replace('.', '-').toLowerCase();

    return (
        <div className={className}>
            <FormField
                control={control}
                name={name}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel htmlFor={id} className="text-sm font-medium">
                            {label}
                            {required && <span className="ml-0.5 text-red-500">*</span>}
                        </FormLabel>
                        <FormControl>
                            <InputOTP
                                maxLength={maxLength}
                                disabled={disabled}
                                {...field}
                                id={id}
                            >
                                <InputOTPGroup>
                                    {Array.from({ length: maxLength }).map((_, index) => (
                                        <InputOTPSlot key={index} index={index} />
                                    ))}
                                </InputOTPGroup>
                            </InputOTP>
                        </FormControl>
                        {description && <FormDescription>{description}</FormDescription>}
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
