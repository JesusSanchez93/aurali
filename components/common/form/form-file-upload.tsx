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
                render={({ field, fieldState }) => (
                    <FormItem>
                        <FormLabel className="text-sm font-medium">
                            {label}
                            {required && <span className="ml-0.5 text-red-500">*</span>}
                        </FormLabel>

                        <FormControl>
                            <FileUpload
                                required={required}
                                value={field.value as any}
                                onChange={(val) => field.onChange(val)}
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
                )}
            />
        </div>
    );
}
