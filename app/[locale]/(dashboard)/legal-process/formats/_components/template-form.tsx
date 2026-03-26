'use client';

import { useRef, useTransition, useState, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import { FormSelect } from '@/components/common/form/form-select';
import Tiptap, { type TiptapHandle } from '@/components/common/tip-tap';
import VariablesPanel from './variables-panel';
import { createTemplate, updateTemplate } from '../actions';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import { SignatureExtension } from '@/components/common/tip-tap/extensions/signature-node';
import { SignatureRowExtension } from '@/components/common/tip-tap/extensions/signature-row-node';
import { ColumnExtension, TwoColumnExtension } from '@/components/common/tip-tap/extensions/two-column-node';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';

// ─── Types ────────────────────────────────────────────────────────────────────
type Alignment = 'left' | 'center' | 'right';
type DocContent = {
    image?: { url: string; alignment: Alignment } | null;
    text?: unknown;
};

type DocOption = { id: string; name: string; is_default: boolean; content: unknown };

const schema = z.object({
    name: z.string().min(1, { message: 'Campo requerido' }),
    content: z.unknown(),
    header_id: z.string().nullable().optional(),
    footer_id: z.string().nullable().optional(),
});
type FormValues = z.infer<typeof schema>;

type Template = {
    id: string;
    name: string | null;
    content: unknown;
    header_id?: string | null;
    footer_id?: string | null;
    version: number | null;
    created_at: string;
};

interface Props {
    template?: Template;
    headers?: DocOption[];
    footers?: DocOption[];
}

// ─── TipTap JSON → HTML ───────────────────────────────────────────────────────
const tiptapExtensions = [
    TextStyleKit,
    StarterKit,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    SignatureExtension,
    SignatureRowExtension,
    ColumnExtension,
    TwoColumnExtension,
    Table.configure({ resizable: false }),
    TableRow,
    TableCell,
    TableHeader,
];

function tiptapToHtml(content: unknown): string {
    if (!content || typeof content !== 'object') return '';
    try {
        const html = generateHTML(content as Parameters<typeof generateHTML>[0], tiptapExtensions);
        // ProseMirror adds a <br> placeholder to empty paragraphs in the editor,
        // but generateHTML omits it. Use &nbsp; (more reliable than <br>) so the
        // paragraph gets full line-height and prose margins in the preview.
        return html.replace(/<p(\s[^>]*)?>(\s*)<\/p>/g, (_, attrs) => `<p${attrs ?? ''}>&nbsp;</p>`);
    } catch {
        return '';
    }
}

// ─── DocContent renderer ─────────────────────────────────────────────────────
function DocContentRenderer({ content, className = '' }: { content: unknown; className?: string }) {
    const c = content as DocContent | null;
    const imageUrl = c?.image?.url;
    const imageAlignment = c?.image?.alignment ?? 'left';
    const textHtml = tiptapToHtml(c?.text);

    const alignClass: Record<Alignment, string> = {
        left: 'justify-start',
        center: 'justify-center',
        right: 'justify-end',
    };

    if (!imageUrl && !textHtml) return null;

    return (
        <div className={`space-y-2 ${className}`}>
            {imageUrl && (
                <div className={`flex ${alignClass[imageAlignment]}`}>
                    <img src={imageUrl} alt="Logo" className="max-h-16 object-contain" />
                </div>
            )}
            {textHtml && (
                <div
                    className="prose prose-sm max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: textHtml }}
                />
            )}
        </div>
    );
}

// ─── Inline mini-preview below select ────────────────────────────────────────
function InlinePreview({ content, label }: { content: unknown; label: string }) {
    const c = content as DocContent | null;
    const imageUrl = c?.image?.url;
    const textHtml = tiptapToHtml(c?.text);
    if (!imageUrl && !textHtml) return null;

    return (
        <div className="mt-2 rounded-md border border-dashed bg-muted/30 px-4 py-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <DocContentRenderer content={content} />
        </div>
    );
}

// ─── Full document preview modal ─────────────────────────────────────────────
function PreviewModal({
    open,
    onOpenChange,
    name,
    headerContent,
    bodyContent,
    footerContent,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    name: string;
    headerContent: unknown;
    bodyContent: unknown;
    footerContent: unknown;
}) {
    const bodyHtml = tiptapToHtml(bodyContent);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* A4 = 794px wide — outer dialog scrolls vertically */}
            <DialogContent className="max-h-[95vh] w-full max-w-[860px] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Vista previa — {name || 'Plantilla'}</DialogTitle>
                </DialogHeader>

                {/* A4 paper: 794px wide, padding simulates margins */}
                <div className="mx-auto mt-2 w-[794px] border bg-white px-16 py-12 pt-0 shadow-sm dark:bg-zinc-950">
                    {/* Header */}
                    {(headerContent as DocContent | null)?.image || (headerContent as DocContent | null)?.text ? (
                        <>
                            <DocContentRenderer content={headerContent} />
                        </>
                    ) : null}

                    {/* Body */}
                    {bodyHtml ? (
                        <div
                            className="prose prose-sm max-w-none [&_[data-type='two-column']]:!flex [&_[data-type='two-column']]:gap-5 [&_[data-type='column']]:!flex-1 [&_[data-type='column']]:min-w-0"
                            dangerouslySetInnerHTML={{ __html: bodyHtml }}
                        />
                    ) : (
                        <p className="text-sm text-muted-foreground italic">Sin contenido aún…</p>
                    )}

                    {/* Footer */}
                    {(footerContent as DocContent | null)?.image || (footerContent as DocContent | null)?.text ? (
                        <>
                            <hr className="my-4 border-foreground/20" />
                            <DocContentRenderer content={footerContent} />
                        </>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main form ────────────────────────────────────────────────────────────────
export default function TemplateForm({ template, headers = [], footers = [] }: Props) {
    const t = useTranslations('formats');
    const commonT = useTranslations('common');
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [previewOpen, setPreviewOpen] = useState(false);
    const isEdit = Boolean(template);
    const tiptapRef = useRef<TiptapHandle>(null);

    const headerOptions = [
        { value: '__none__', label: 'Sin cabecera' },
        ...headers.map((h) => ({ value: h.id, label: h.is_default ? `${h.name} (Default)` : h.name })),
    ];
    const footerOptions = [
        { value: '__none__', label: 'Sin pie de página' },
        ...footers.map((f) => ({ value: f.id, label: f.is_default ? `${f.name} (Default)` : f.name })),
    ];

    const defaultHeader = template?.header_id ?? headers.find((h) => h.is_default)?.id ?? '__none__';
    const defaultFooter = template?.footer_id ?? footers.find((f) => f.is_default)?.id ?? '__none__';

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: template?.name ?? '',
            content: template?.content ?? '',
            header_id: defaultHeader,
            footer_id: defaultFooter,
        },
    });

    const watchedHeaderId = useWatch({ control: form.control, name: 'header_id' });
    const watchedFooterId = useWatch({ control: form.control, name: 'footer_id' });
    const watchedContent  = useWatch({ control: form.control, name: 'content' });

    const selectedHeader = useMemo(
        () => headers.find((h) => h.id === watchedHeaderId) ?? null,
        [headers, watchedHeaderId],
    );
    const selectedFooter = useMemo(
        () => footers.find((f) => f.id === watchedFooterId) ?? null,
        [footers, watchedFooterId],
    );

    const onSubmit = (values: FormValues) => {
        startTransition(async () => {
            try {
                const payload = {
                    ...values,
                    content: values.content ?? '',
                    header_id: values.header_id === '__none__' ? null : values.header_id,
                    footer_id: values.footer_id === '__none__' ? null : values.footer_id,
                };
                if (isEdit && template) {
                    await updateTemplate(template.id, payload);
                } else {
                    await createTemplate(payload);
                }
                toast.success(isEdit ? t('update_success') : t('create_success'));
                router.push('/legal-process/formats');
            } catch {
                toast.error(commonT('error'));
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/legal-process/formats')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-semibold">{isEdit ? t('edit_title') : t('new_title')}</h1>
                        <p className="text-sm text-muted-foreground">{t('form_description')}</p>
                    </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                    <Eye className="mr-1.5 h-4 w-4" />
                    Vista previa
                </Button>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">

                        {/* Editor area */}
                        <div className="space-y-6">
                            <div className="rounded-lg border bg-card p-6 space-y-6">
                                <FormInput
                                    control={form.control}
                                    name="name"
                                    label={t('field_name')}
                                    placeholder={t('field_name_placeholder')}
                                    required
                                />

                                {/* Header select + inline preview */}
                                <div>
                                    <FormSelect
                                        control={form.control}
                                        name="header_id"
                                        label="Cabecera"
                                        options={headerOptions}
                                    />
                                    {selectedHeader && (
                                        <InlinePreview
                                            content={selectedHeader.content}
                                            label="Vista previa de cabecera"
                                        />
                                    )}
                                </div>

                                {/* Body editor */}
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
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Footer select + inline preview */}
                                <div>
                                    <FormSelect
                                        control={form.control}
                                        name="footer_id"
                                        label="Pie de página"
                                        options={footerOptions}
                                    />
                                    {selectedFooter && (
                                        <InlinePreview
                                            content={selectedFooter.content}
                                            label="Vista previa de pie de página"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.push('/legal-process/formats')}
                                    disabled={isPending}
                                >
                                    {commonT('cancel')}
                                </Button>
                                <Button type="submit" disabled={isPending}>
                                    {isPending ? commonT('loading') : commonT('save')}
                                </Button>
                            </div>
                        </div>

                        {/* Variables panel */}
                        <VariablesPanel
                            onInsert={(variable) => tiptapRef.current?.insertText(variable)}
                            onInsertTwoColumn={() => tiptapRef.current?.insertTwoColumn()}
                        />
                    </div>
                </form>
            </Form>

            {/* Full document preview modal */}
            <PreviewModal
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                name={form.getValues('name')}
                headerContent={selectedHeader?.content ?? null}
                bodyContent={watchedContent}
                footerContent={selectedFooter?.content ?? null}
            />
        </div>
    );
}
