"use client";

import { JSX } from "react";
import { Control, FieldValues, Path } from "react-hook-form";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "../../ui/form";
import { ImageUpload, ImageUploadValue } from "../image-upload";


interface Props<T extends FieldValues> {
    control?: Control<T>; // opcional → permite usarlo fuera de RHF
    name?: Path<T>;       // opcional → requerido solo si se usa con RHF
    label: string;
    required?: boolean;
    description?: string;
    disabled?: boolean;
    className?: string;

    // modo NO-RHF
    value?: ImageUploadValue;
    onChange?: (value?: ImageUploadValue) => void;
    onDeleteClick?: () => void;
}

export function FormImageUpload<T extends FieldValues>(props: Props<T>): JSX.Element {
    const {
        control,
        name,
        label,
        required,
        description,
        disabled,
        className,
        value,
        onChange,
        onDeleteClick,
    } = props;

    if (!control || !name) {
        if (!value || !onChange) {
            throw new Error(
                "FormImageUpload: cuando no usas react-hook-form debes pasar value y onChange"
            );
        }

        return (
            <div className={className}>
                <label className="text-sm font-medium">
                    {label}
                    {required && <span className="ml-0.5 text-red-500">*</span>}
                </label>

                <ImageUpload
                    required={required}
                    value={value}
                    onChange={onChange}
                    onDeleteClick={onDeleteClick}
                />

                {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                )}
            </div>
        );
    }

    return (
        <div className={className}>
            <FormField
                control={control}
                name={name}
                render={({ field, fieldState }) => (
                    <FormItem>
                        <FormLabel className="text-sm font-medium">
                            {label}
                            {required && <span className="ml-0.5 text-red-500">*</span>}
                        </FormLabel>

                        <FormControl>
                            <ImageUpload
                                required={required}
                                value={{
                                    file: (field.value as any) instanceof File ? field.value : null,
                                    previewUrl: (field.value as any) instanceof File
                                        ? URL.createObjectURL(field.value)
                                        : (typeof field.value === 'string' ? field.value : undefined),
                                }}
                                onChange={(val) => field.onChange(val?.file)}
                                onDeleteClick={onDeleteClick}
                            />
                        </FormControl>

                        {description && (
                            <FormDescription>{description}</FormDescription>
                        )}

                        {fieldState.error && <FormMessage />}
                    </FormItem>
                )}
            />
        </div>
    );
}