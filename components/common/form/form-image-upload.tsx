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
                    disabled={disabled}
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
                render={({ field, fieldState }) => {
                    const fieldValue = field.value as unknown;
                    return (
                    <FormItem>
                        <FormLabel className="text-sm font-medium">
                            {label}
                            {required && <span className="ml-0.5 text-red-500">*</span>}
                        </FormLabel>

                        <FormControl>
                            <ImageUpload
                                required={required}
                                disabled={disabled}
                                value={{
                                    file: fieldValue instanceof File ? fieldValue : null,
                                    previewUrl: fieldValue instanceof File
                                        ? URL.createObjectURL(fieldValue)
                                        : (typeof fieldValue === 'string' ? fieldValue : undefined),
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
                    );
                }}
            />
        </div>
    );
}