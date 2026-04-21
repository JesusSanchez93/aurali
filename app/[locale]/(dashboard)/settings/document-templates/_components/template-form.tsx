'use client';

import { useRef, useTransition, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft, Eye } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormInput } from '@/components/common/form/form-input';
import Tiptap, { type TiptapHandle } from '@/components/common/tip-tap';
import { DocumentPreview } from '@/components/common/tip-tap/document-preview';
import type { AiVariable } from '@/app/[locale]/(dashboard)/settings/ai-variables/actions';
import { createTemplate, updateTemplate } from '../actions';
import VariablesPanel from './variables-panel';
import { VARIABLE_GROUPS } from './variables';

// ─── Font options ─────────────────────────────────────────────────────────────
const FONT_OPTIONS = [
  { value: 'Inter',            label: 'Inter',            group: 'Sans-serif' },
  { value: 'Roboto',           label: 'Roboto',           group: 'Sans-serif' },
  { value: 'Lato',             label: 'Lato',             group: 'Sans-serif' },
  { value: 'Open Sans',        label: 'Open Sans',        group: 'Sans-serif' },
  { value: 'Merriweather',     label: 'Merriweather',     group: 'Serif' },
  { value: 'EB Garamond',      label: 'EB Garamond',      group: 'Serif' },
  { value: 'Times New Roman',  label: 'Times New Roman',  group: 'Serif' },
  { value: 'Georgia',          label: 'Georgia',          group: 'Serif' },
] as const;

const schema = z.object({
    name: z.string().min(1, { message: 'Campo requerido' }),
    content: z.unknown(),
    font_family: z.string().default('Inter'),
    header: z.string().default(''),
    footer: z.string().default(''),
});
type FormValues = z.infer<typeof schema>;

type Template = {
    id: string;
    name: string | null;
    content: unknown;
    font_family?: string | null;
    header_left?: string | null;
    footer_left?: string | null;
    version: number | null;
    created_at: string;
};

const EMPTY_AI_VARIABLES: AiVariable[] = [];

interface Props {
    template?: Template;
    aiVariables?: AiVariable[];
}

export default function TemplateForm({ template, aiVariables = EMPTY_AI_VARIABLES }: Props) {
    const t = useTranslations('formats');
    const commonT = useTranslations('common');
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [previewContent, setPreviewContent] = useState<unknown>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const isEdit = Boolean(template);
    const tiptapRef = useRef<TiptapHandle>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: template?.name ?? '',
            content: template?.content ?? '',
            font_family: template?.font_family ?? 'Inter',
            header: template?.header_left ?? '',
            footer: template?.footer_left ?? '',
        },
    });

    const onSubmit = (values: FormValues) => {
        startTransition(async () => {
            try {
                const rawContent = tiptapRef.current?.getContent() ?? values.content ?? '';
                const editorContent = JSON.parse(JSON.stringify(rawContent));
                const payload = {
                    name: values.name,
                    content: editorContent,
                    font_family: values.font_family,
                    header_left: values.header,
                    header_right: '',
                    footer_left: values.footer,
                    footer_right: '',
                };
                if (isEdit && template) {
                    await updateTemplate(template.id, payload);
                } else {
                    await createTemplate(payload);
                }
                toast.success(isEdit ? t('update_success') : t('create_success'));
                router.push('/settings/document-templates');
            } catch {
                toast.error(commonT('error'));
            }
        });
    };

    const handlePreview = () => {
        const content = tiptapRef.current?.getContent();
        if (!content) { toast.error('El editor está vacío'); return; }

        const fakeData: Record<string, string> = {
            'CLIENT.FIRST_NAME': 'Juan',
            'CLIENT.LAST_NAME': 'Pérez García',
            'CLIENT.DOCUMENT_TYPE': 'DNI',
            'CLIENT.DOCUMENT_NAME': 'DNI',
            'CLIENT.DOCUMENT_NUMBER': '12.345.678',
            'CLIENT.EMAIL': 'juan.perez@email.com',
            'CLIENT.PHONE': '+54 9 11 1234-5678',
            'CLIENT.ADDRESS': 'Av. Corrientes 1234, CABA',
            'PROCESS.ID': 'PROC-2026-0001',
            'PROCESS.DATE': '11/04/2026',
            'PROCESS.STATUS': 'En proceso',
            'PROCESS.FEE_AMOUNT': '$150.000',
            'BANKING.NAME': 'Banco Ejemplo S.A.',
            'BANKING.DOCUMENT_SLUG': 'CUIT',
            'BANKING.DOCUMENT_NUMBER': '30-12345678-9',
            'BANKING.LAST_4_DIGITS': '4567',
            'BANKING.FRAUD_INCIDENT_SUMMARY': 'Se detectó una transacción no autorizada por $50.000 el 01/04/2026.',
            'BANKING.LEGAL_REP_FIRST_NAME': 'Carlos',
            'BANKING.LEGAL_REP_LAST_NAME': 'Rodríguez',
            'LAWYER.FIRST_NAME': 'María',
            'LAWYER.LAST_NAME': 'González López',
            'LAWYER.DOCUMENT_TYPE': 'DNI',
            'LAWYER.DOCUMENT_NAME': 'DNI',
            'LAWYER.DOCUMENT_NUMBER': '98.765.432',
            'LAWYER.SIGNATURE': '[Firma del abogado]',
            'ORG_REP.NAME': 'Estudio Jurídico Ejemplo',
            'ORG_REP.FIRST_NAME': 'Roberto',
            'ORG_REP.LAST_NAME': 'Martínez',
            'ORG_REP.DOCUMENT_TYPE': 'DNI',
            'ORG_REP.DOCUMENT_NAME': 'DNI',
            'ORG_REP.DOCUMENT_NUMBER': '45.678.901',
            'ORG_REP.EMAIL': 'representante@bufete.com',
        };

        // Substitute variables directly in TipTap JSON (text nodes + legacy atom nodes).
        // Returns null for nodes that become empty — caller must filter nulls from content arrays.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        function substituteNode(node: any): any {
            if (!node) return null;
            // Legacy variable atom node → text node with substituted value
            if (node.type === 'variable' && node.attrs?.variable) {
                const key: string = node.attrs.variable;
                const val = fakeData[key] ?? `{${key}}`;
                return val ? { type: 'text', text: val } : null;
            }
            // Text node → replace {KEY} patterns; skip if result is empty (ProseMirror forbids empty text nodes)
            if (typeof node.text === 'string') {
                const text = node.text.replace(/\{([\w.]+)\}/g, (_m: string, k: string) => fakeData[k] ?? _m);
                return text ? { ...node, text } : null;
            }
            // Container node → recurse and filter out null children
            if (Array.isArray(node.content)) {
                const content = node.content.map(substituteNode).filter(Boolean);
                return { ...node, content };
            }
            return node;
        }

        setPreviewContent(substituteNode(content));
        setPreviewOpen(true);
    };

    // Reactive header/footer values — form.getValues() is not reactive; watch()
    // subscribes to field changes so Tiptap receives the latest value.
    const headerValue = form.watch('header');
    const footerValue = form.watch('footer');

    // Inline editor callbacks — update form state when user applies header/footer changes
    const handleHeaderChange = useCallback((content: string) => {
        form.setValue('header', content, { shouldDirty: true });
    }, [form]);

    const handleFooterChange = useCallback((content: string) => {
        form.setValue('footer', content, { shouldDirty: true });
    }, [form]);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.push('/settings/document-templates')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-xl font-semibold">{isEdit ? t('edit_title') : t('new_title')}</h1>
                    <p className="text-sm text-muted-foreground">{t('form_description')}</p>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_350px] items-start">

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormInput
                                    control={form.control}
                                    name="name"
                                    label={t('field_name')}
                                    placeholder={t('field_name_placeholder')}
                                    required
                                />
                                <FormField
                                    control={form.control}
                                    name="font_family"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Fuente del documento</FormLabel>
                                            <FormControl>
                                                <select
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                                                    style={{ fontFamily: field.value }}
                                                >
                                                    {FONT_OPTIONS.map((opt) => (
                                                        <option
                                                            key={opt.value}
                                                            value={opt.value}
                                                            style={{ fontFamily: opt.value }}
                                                        >
                                                            {opt.label} ({opt.group})
                                                        </option>
                                                    ))}
                                                </select>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="content"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('field_content')}</FormLabel>
                                        <FormControl>
                                            <Tiptap
                                                ref={tiptapRef}
                                                value={field.value}
                                                onChange={field.onChange}
                                                mode="document"
                                                variableGroups={VARIABLE_GROUPS}
                                                aiVariableKeys={aiVariables?.map((v) => v.key)}
                                                header={headerValue}
                                                footer={footerValue}
                                                onHeaderChange={handleHeaderChange}
                                                onFooterChange={handleFooterChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex justify-end gap-3  sticky bottom-0 bg-background/80 py-4 z-30 backdrop-blur-sm">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => router.push('/settings/document-templates')}
                                        disabled={isPending}
                                    >
                                        {commonT('cancel')}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handlePreview}
                                        disabled={isPending}
                                    >
                                        <Eye className="h-4 w-4" />
                                        Vista previa
                                    </Button>
                                    <Button type="submit" disabled={isPending}>
                                        {isPending ? commonT('loading') : commonT('save')}
                                    </Button>
                            </div>
                        </div>

                        <VariablesPanel
                            onInsert={(variable) => tiptapRef.current?.insertVariable(variable)}
                            variableGroups={VARIABLE_GROUPS}
                            aiVariables={aiVariables}
                        />
                    </div>
                </form>
            </Form>

            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-[900px] h-[92vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="px-6 py-4 border-b shrink-0">
                        <DialogTitle>Vista previa — {form.getValues('name') || 'Documento'}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 min-h-0">
                        {!!previewContent && previewOpen && (
                            <DocumentPreview
                                key={previewOpen ? 'open' : 'closed'}
                                content={previewContent}
                                fontFamily={form.getValues('font_family')}
                                header={headerValue}
                                footer={footerValue}
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
