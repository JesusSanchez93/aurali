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
import { FileUpload, FileUploadValue } from "../file-upload";

interface Props<T extends FieldValues> {
    control?: Control<T>;
    name?: Path<T>;
    label: string;
    required?: boolean;
    description?: string;
    disabled?: boolean;
    className?: string;
    accept?: string;
    multiple?: boolean;
    maxFiles?: number;

    // modo NO-RHF
    value?: FileUploadValue | FileUploadValue[];
    onChange?: (value?: FileUploadValue | FileUploadValue[]) => void;
    onDeleteClick?: (index?: number) => void;
}

export function FormFileUpload<T extends FieldValues>(props: Props<T>): JSX.Element {
    const {
        control,
        name,
        label,
        required,
        description,
        disabled,
        className,
        accept = '.pdf',
        multiple = false,
        maxFiles = 3,
        value,
        onChange,
        onDeleteClick,
    } = props;

    if (!control || !name) {
        if (value === undefined || !onChange) {
            throw new Error(
                "FormFileUpload: cuando no usas react-hook-form debes pasar value y onChange"
            );
        }

        return (
            <div className={className}>
                <label className="text-sm font-medium mb-2 block">
                    {label}
                    {required && <span className="ml-0.5 text-red-500">*</span>}
                </label>

                <FileUpload
                    required={required}
                    disabled={disabled}
                    value={value}
                    onChange={onChange}
                    onDeleteClick={onDeleteClick}
                    accept={accept}
                    multiple={multiple}
                    maxFiles={maxFiles}
                />

                {description && (
                    <p className="text-sm text-muted-foreground mt-2">{description}</p>
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
                    // El valor "de verdad" en RHF/Zod (ver buildZodSchema.ts,
                    // formDataCodec.ts) es File nuevo o string (path ya subido,
                    // al recargar un avance parcial) — nunca el wrapper
                    // {file, name} que FileUpload usa solo para su propio
                    // render. Mismo patrón de conversión que FormImageUpload,
                    // generalizado para el caso multi-archivo.
                    const rawValue = field.value as File | string | (File | string)[] | null | undefined;

                    const toDisplayValue = (v: File | string): FileUploadValue => ({
                        file: v instanceof File ? v : null,
                        name: v instanceof File ? v.name : v,
                    });

                    const displayValue: FileUploadValue | FileUploadValue[] | undefined =
                        rawValue == null
                            ? undefined
                            : Array.isArray(rawValue)
                                ? rawValue.map(toDisplayValue)
                                : toDisplayValue(rawValue);

                    const toRawValue = (v: FileUploadValue): File | string => v.file ?? v.name ?? '';

                    const handleChange = (val?: FileUploadValue | FileUploadValue[]) => {
                        if (val === undefined) {
                            field.onChange(undefined);
                            return;
                        }
                        field.onChange(Array.isArray(val) ? val.map(toRawValue) : toRawValue(val));
                    };

                    return (
                        <FormItem>
                            <FormLabel className="text-sm font-medium">
                                {label}
                                {required && <span className="ml-0.5 text-red-500">*</span>}
                            </FormLabel>

                            <FormControl>
                                <FileUpload
                                    required={required}
                                    disabled={disabled}
                                    value={displayValue}
                                    onChange={handleChange}
                                    onDeleteClick={onDeleteClick}
                                    accept={accept}
                                    multiple={multiple}
                                    maxFiles={maxFiles}
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
