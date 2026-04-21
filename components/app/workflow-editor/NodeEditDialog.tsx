'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, FormProvider } from 'react-hook-form';
import { Loader2, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/common/form/form-input';
import Tiptap from '@/components/common/tip-tap';
import type { WorkflowNode } from './types';

interface NodeEditDialogProps {
  node: WorkflowNode | null;
  templateId: string;
  onClose: () => void;
  onSave: (
    templateId: string,
    nodeId: string,
    config: { subject?: string; body?: unknown },
  ) => Promise<void>;
}

interface FormValues {
  subject: string;
}

/** Convert a legacy plain-text body to TipTap-compatible HTML. */
function legacyToHtml(text: string): string {
  return text
    .split('\n\n')
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function resolveInitialBody(node: NodeEditDialogProps['node']): unknown {
  if (!node) return null;
  const raw = (node.data.config as Record<string, unknown>).body;
  if (!raw) return null;
  if (typeof raw === 'string') return legacyToHtml(raw);
  return raw;
}

export function NodeEditDialog({
  node,
  templateId,
  onClose,
  onSave,
}: NodeEditDialogProps) {
  const router = useRouter();
  const t = useTranslations('settings.workflow_editor');
  const tCommon = useTranslations('common');
  const [isSaving, setIsSaving] = useState(false);
  const [bodyContent, setBodyContent] = useState<unknown>(() => resolveInitialBody(node));

  const form = useForm<FormValues>({
    defaultValues: { subject: String((node?.data.config as Record<string, unknown>)?.subject ?? '') },
  });
  const { handleSubmit, reset, control } = form;

  useEffect(() => {
    if (!node) return;
    const cfg = node.data.config as Record<string, unknown>;
    reset({ subject: String(cfg.subject ?? '') });
    setBodyContent(resolveInitialBody(node));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  const onSubmit = async (values: FormValues) => {
    if (!node) return;
    setIsSaving(true);
    try {
      await onSave(templateId, node.id, {
        subject: values.subject,
        body: bodyContent,
      });
      toast.success(t('email_save_success'));
      router.refresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('email_save_error'));
    } finally {
      setIsSaving(false);
    }
  };

  const hasAttachments = (node?.data.config as Record<string, unknown>)?.attach_enabled === true;
  // const VARIABLES = ['{CLIENT.FIRST_NAME}', '{CLIENT.LAST_NAME}', '{FORM_URL}', '{PROCESS.ID}'];

  return (
    <Dialog open={!!node} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl p-0">
        <DialogHeader className='p-6'>
          <DialogTitle>
            {t('email_edit_title', { title: node?.data.title ?? '' })}
          </DialogTitle>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">

            {hasAttachments && (
              <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p className="text-xs">{t('email_attachment_hint')}</p>
              </div>
            )}

            <FormInput
              control={control}
              name="subject"
              label={t('email_subject_label')}
              placeholder={t('email_subject_placeholder')}
            />

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t('email_body_label')}</span>
              <Tiptap key={node?.id} value={bodyContent} onChange={setBodyContent} menuBarStickyTop='-1px' />
              {/* <div className="flex flex-wrap gap-1 pt-1">
              {VARIABLES.map((v) => (
                <code
                  key={v}
                  className="cursor-default rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                >
                  {v}
                </code>
              ))}
            </div> */}
            </div>

            <DialogFooter className="mt-auto pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tCommon('save')}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
