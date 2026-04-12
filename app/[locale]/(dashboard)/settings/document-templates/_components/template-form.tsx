'use client';

import { useRef, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/common/form/form-input';
import Tiptap, { type TiptapHandle } from '@/components/common/tip-tap';
import type { AiVariable } from '@/app/[locale]/(dashboard)/settings/ai-variables/actions';
import { createTemplate, updateTemplate } from '../actions';
import VariablesPanel from './variables-panel';

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
});
type FormValues = z.infer<typeof schema>;

type Template = {
    id: string;
    name: string | null;
    content: unknown;
    font_family?: string | null;
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
    const isEdit = Boolean(template);
    const tiptapRef = useRef<TiptapHandle>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: template?.name ?? '',
            content: template?.content ?? '',
            font_family: template?.font_family ?? 'Inter',
        },
    });

    const onSubmit = (values: FormValues) => {
        startTransition(async () => {
            try {
                const rawContent = tiptapRef.current?.getContent() ?? values.content ?? '';
                const editorContent = JSON.parse(JSON.stringify(rawContent));
                const payload = { ...values, content: editorContent };
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
                                                aiVariableKeys={aiVariables?.map((v) => v.key)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex justify-end gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.push('/settings/document-templates')}
                                    disabled={isPending}
                                >
                                    {commonT('cancel')}
                                </Button>
                                <Button type="submit" disabled={isPending}>
                                    {isPending ? commonT('loading') : commonT('save')}
                                </Button>
                            </div>
                        </div>

                        <VariablesPanel
                            onInsert={(variable) => tiptapRef.current?.insertVariable(variable)}
                            aiVariables={aiVariables}
                        />
                    </div>
                </form>
            </Form>
        </div>
    );
}
