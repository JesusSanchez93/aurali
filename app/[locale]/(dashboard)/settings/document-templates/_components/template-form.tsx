'use client';

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/routing';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { toast } from '@/lib/toast';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUpload, type FileUploadValue } from '@/components/common/file-upload';
import { createTemplateWithDocx } from '../actions';

const DOCX_ACCEPT = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export default function TemplateForm() {
    const t = useTranslations('formats');
    const commonT = useTranslations('common');
    const router = useRouter();
    const locale = useLocale();
    const [isPending, startTransition] = useTransition();
    const [name, setName] = useState('');
    const [docx, setDocx] = useState<FileUploadValue | undefined>(undefined);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) { toast.error('El nombre es requerido'); return; }
        if (!docx?.file) { toast.error('Sube un archivo .docx'); return; }

        startTransition(async () => {
            try {
                const { id } = await createTemplateWithDocx(name.trim(), docx.file!);
                toast.success(t('create_success'));
                window.open(`/${locale}/document-templates/edit/${id}`, '_blank', 'noopener,noreferrer');
                router.push('/settings/document-templates');
            } catch {
                toast.error(commonT('error'));
            }
        });
    };

    return (
        <div className="mx-auto max-w-xl space-y-6">
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => router.push('/settings/document-templates')}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                        <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold leading-tight tracking-tight">{t('new_title')}</h1>
                        <p className="text-sm text-muted-foreground">{t('form_description')}</p>
                    </div>
                </div>
            </div>

            <motion.form
                onSubmit={handleSubmit}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="space-y-6 rounded-xl border bg-card p-6 shadow-sm"
            >
                <div className="space-y-2">
                    <Label htmlFor="template-name" className="text-sm font-medium">{t('field_name')}</Label>
                    <Input
                        id="template-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('field_name_placeholder')}
                        className="h-11"
                        autoFocus
                        required
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('field_docx')}</Label>
                    <FileUpload accept={DOCX_ACCEPT} value={docx} onChange={(v) => setDocx(v as FileUploadValue)} required />
                    <p className="text-xs leading-relaxed text-muted-foreground">{t('field_docx_hint')}</p>
                </div>

                <div className="flex justify-end gap-3 border-t pt-5">
                    <Button type="button" variant="outline" onClick={() => router.push('/settings/document-templates')} disabled={isPending}>
                        {commonT('cancel')}
                    </Button>
                    <Button type="submit" disabled={isPending} className="min-w-36">
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isPending ? commonT('loading') : t('upload_and_create')}
                    </Button>
                </div>
            </motion.form>
        </div>
    );
}
