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
import { Switch } from '../../ui/switch';
import { cn } from '@/lib/utils';

interface Props<T extends FieldValues> {
    control: Control<T>;
    disabled?: boolean;
    name: Path<T>;
    label: string;
    required?: boolean;
    className?: string; // For the outer wrapper
    itemClassName?: string; // For the FormItem wrapper
    description?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    showLabel?: boolean; // Whether to show 'Sí' / 'No' next to the switch
}

export function FormSwitch<T extends FieldValues>({
    control,
    disabled,
    name,
    label,
    required,
    className,
    itemClassName,
    description,
    size = 'md',
    showLabel = false,
}: Props<T>): JSX.Element {
    const id = name.replace('.', '-').toLowerCase();

    return (
        <div className={className}>
            <FormField
                control={control}
                name={name}
                render={({ field }) => (
                    <FormItem
                        className={cn(
                            itemClassName
                        )}
                    >
                        <div className="space-y-0.5">
                            <FormLabel htmlFor={id} className="text-sm font-medium">
                                {label}
                                {required && <span className="ml-0.5 text-red-500">*</span>}
                            </FormLabel>
                            {description && <FormDescription>{description}</FormDescription>}
                        </div>
                        <div className="flex items-center gap-3">
                            <FormControl>
                                <Switch
                                    id={id}
                                    checked={!!field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={disabled}
                                    name={field.name}
                                    ref={field.ref}
                                    onBlur={field.onBlur}
                                    size={size}
                                />
                            </FormControl>
                            {showLabel && (
                                <span className={cn(
                                    "text-sm font-medium",
                                    field.value ? "text-primary" : "text-muted-foreground"
                                )}>
                                    {field.value ? 'Sí' : 'No'}
                                </span>
                            )}
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
