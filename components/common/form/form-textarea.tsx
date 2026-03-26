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
import { Textarea } from '../../ui/textarea';

interface Props<T extends FieldValues> {
    control: Control<T>;
    disabled?: boolean;
    name: Path<T>;
    label: string;
    placeholder?: string;
    required?: boolean;
    className?: string;
    description?: string;
    rows?: number;
}

export function FormTextarea<T extends FieldValues>({
    control,
    disabled,
    name,
    label,
    placeholder,
    required,
    className,
    description,
    rows,
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
                            <Textarea
                                {...field}
                                id={id}
                                disabled={disabled}
                                placeholder={placeholder}
                                rows={rows || 3}
                                className="resize-y bg-white dark:bg-black"
                            />
                        </FormControl>
                        {description && <FormDescription>{description}</FormDescription>}
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
