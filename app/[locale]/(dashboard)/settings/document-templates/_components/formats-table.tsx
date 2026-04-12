'use client';

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { FileText, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { deleteTemplate } from '../actions';
import { toast } from 'sonner';

type Template = {
    id: string;
    name: string | null;
    version: number | null;
    created_at: string;
};

interface Props {
    templates: Template[];
}

export default function FormatsTable({ templates }: Props) {
    const t = useTranslations('formats');
    const commonT = useTranslations('common');
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const handleDelete = () => {
        if (!deleteId) return;
        startTransition(async () => {
            try {
                await deleteTemplate(deleteId);
                toast.success(t('delete_success'));
            } catch {
                toast.error(commonT('error'));
            }
        });
    };

    if (templates.length === 0) {
        return (
            <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center animate-in fade-in-50">
                <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{t('empty')}</p>
            </div>
        );
    }

    return (
        <>
            <div className="rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/50">
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('col_name')}</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('col_version')}</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('col_created_at')}</th>
                            <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('col_actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {templates.map((template, index) => (
                            <tr
                                key={template.id}
                                className="border-b last:border-0 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <td className="px-4 py-3 font-medium">{template.name ?? '—'}</td>
                                <td className="px-4 py-3 text-muted-foreground">v{template.version ?? 1}</td>
                                <td className="px-4 py-3 text-muted-foreground">
                                    {new Date(template.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => router.push(`/settings/document-templates/edit/${template.id}`)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={isPending}
                                            onClick={() => setDeleteId(template.id)}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ConfirmDialog
                isOpen={Boolean(deleteId)}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title={t('delete_title')}
                description={t('delete_description')}
                confirmLabel={commonT('delete')}
                variant="destructive"
            />
        </>
    );
}
