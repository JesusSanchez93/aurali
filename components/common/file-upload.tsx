'use client';

import { Button } from '@/components/ui/button';
import { FileText, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useTranslations } from 'next-intl';

export interface FileUploadValue {
    file: File | null;
    name?: string;
}

interface Props {
    required?: boolean;
    value?: FileUploadValue | FileUploadValue[];
    onChange: (value: FileUploadValue | FileUploadValue[] | undefined) => void;
    onDeleteClick?: (index?: number) => void;
    accept?: string;
    multiple?: boolean;
    maxFiles?: number;
}

export function FileUpload({
    required = false,
    value,
    onChange,
    onDeleteClick,
    accept = '.pdf',
    multiple = false,
    maxFiles = 3,
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null);

    const valuesArray = Array.isArray(value) ? value : value ? [value] : [];

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        if (multiple) {
            const newValues = files.map((file) => ({ file, name: file.name }));
            const combined = [...valuesArray, ...newValues].slice(0, maxFiles);
            onChange(combined);
        } else {
            onChange({ file: files[0], name: files[0].name });
        }

        if (inputRef.current) {
            inputRef.current.value = ''; // Reset input
        }
    };

    const handleDelete = (index: number) => {
        if (onDeleteClick) {
            onDeleteClick(multiple ? index : undefined);
        } else {
            if (multiple) {
                const newValues = [...valuesArray];
                newValues.splice(index, 1);
                onChange(newValues.length > 0 ? newValues : undefined);
            } else {
                onChange(undefined);
            }
        }
    };

    const showInput = multiple ? valuesArray.length < maxFiles : valuesArray.length === 0;

    const t = useTranslations('common.upload');
    const remainingCount = maxFiles - valuesArray.length;

    return (
        <div className="space-y-3">
            {valuesArray.length > 0 && (
                <div className="space-y-2">
                    {valuesArray.map((val, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between p-3 border rounded-md bg-muted/50"
                        >
                            <div className="flex items-center space-x-3 overflow-hidden">
                                <FileText className="h-5 w-5 flex-shrink-0 text-blue-500" />
                                <span className="text-sm truncate font-medium">
                                    {val.name || val.file?.name || t('document_fallback')}
                                </span>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDelete(index)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {showInput && (
                <div>
                    <input
                        ref={inputRef}
                        type="file"
                        accept={accept}
                        multiple={multiple}
                        onChange={onFileChange}
                        className="hidden"
                        required={required && valuesArray.length === 0}
                    />
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-6 text-gray-500 transition hover:border-gray-400 hover:text-gray-600 bg-white dark:bg-black"
                    >
                        <span className="text-sm font-medium">{t('click_to_upload')}</span>
                        <span className="text-xs text-muted-foreground mt-1">
                            {accept.replace(/\./g, '').toUpperCase()} {multiple ? t('can_upload_more', { count: remainingCount, pluralShort: remainingCount === 1 ? '' : 's' }) : ''}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}
