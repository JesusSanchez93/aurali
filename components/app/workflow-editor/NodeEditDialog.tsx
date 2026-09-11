'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, useWatch, FormProvider } from 'react-hook-form';
import { ChevronDownIcon, Loader2, Paperclip } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { FormInput } from '@/components/common/form/form-input';
import { FormSelect } from '@/components/common/form/form-select';
import Tiptap from '@/components/common/tip-tap';
import type { WorkflowNode } from './types';

/** Config fields a lawyer (not the admin) is allowed to set for an
 * email node — subject/body plus, when the admin turned on
 * "seguimiento" (track_follow_up) in the builder, the follow-up
 * schedule and reminder texts sent to the client. */
export interface EmailNodeEditConfig {
  subject?: string;
  body?: unknown;
  follow_up_value?: string;
  follow_up_unit?: string;
  reminder_count?: string;
  reminder_subject?: string;
  reminder_body?: unknown;
}

interface NodeEditDialogProps {
  node: WorkflowNode | null;
  templateId: string;
  onClose: () => void;
  onSave: (
    templateId: string,
    nodeId: string,
    config: EmailNodeEditConfig,
  ) => Promise<void>;
}

interface FormValues {
  subject: string;
  follow_up_value: string;
  follow_up_unit: string;
  reminder_count: string;
  reminder_subject: string;
}

const FOLLOW_UP_UNIT_OPTIONS = [
  { value: 'hours', label: 'Horas' },
  { value: 'days',  label: 'Días' },
];

const REMINDER_COUNT_OPTIONS = [
  { value: '1', label: '1 recordatorio' },
  { value: '2', label: '2 recordatorios' },
  { value: '3', label: '3 recordatorios' },
];

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

function resolveInitialReminderBody(node: NodeEditDialogProps['node']): unknown {
  if (!node) return null;
  const raw = (node.data.config as Record<string, unknown>).reminder_body;
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
  const [reminderBodyContent, setReminderBodyContent] = useState<unknown>(() => resolveInitialReminderBody(node));

  const configOf = (n: NodeEditDialogProps['node']) => (n?.data.config ?? {}) as Record<string, unknown>;

  const form = useForm<FormValues>({
    defaultValues: {
      subject: String(configOf(node).subject ?? ''),
      follow_up_value: String(configOf(node).follow_up_value ?? '24'),
      follow_up_unit: String(configOf(node).follow_up_unit ?? 'hours'),
      reminder_count: String(configOf(node).reminder_count ?? '1'),
      reminder_subject: String(configOf(node).reminder_subject ?? ''),
    },
  });
  const { handleSubmit, reset, control, register, setValue } = form;
  const followUpUnit = useWatch({ control, name: 'follow_up_unit' });
  const followUpUnitLabel = FOLLOW_UP_UNIT_OPTIONS.find((o) => o.value === followUpUnit)?.label ?? FOLLOW_UP_UNIT_OPTIONS[0].label;

  useEffect(() => {
    if (!node) return;
    const cfg = configOf(node);
    reset({
      subject: String(cfg.subject ?? ''),
      follow_up_value: String(cfg.follow_up_value ?? '24'),
      follow_up_unit: String(cfg.follow_up_unit ?? 'hours'),
      reminder_count: String(cfg.reminder_count ?? '1'),
      reminder_subject: String(cfg.reminder_subject ?? ''),
    });
    setBodyContent(resolveInitialBody(node));
    setReminderBodyContent(resolveInitialReminderBody(node));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  const trackFollowUp = configOf(node).track_follow_up === true;

  const onSubmit = async (values: FormValues) => {
    if (!node) return;
    setIsSaving(true);
    try {
      await onSave(templateId, node.id, {
        subject: values.subject,
        body: bodyContent,
        ...(trackFollowUp && {
          follow_up_value: values.follow_up_value,
          follow_up_unit: values.follow_up_unit,
          reminder_count: values.reminder_count,
          reminder_subject: values.reminder_subject,
          reminder_body: reminderBodyContent,
        }),
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

  const hasAttachments = configOf(node).attach_enabled === true;
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
              <Tiptap key={node?.id} value={bodyContent} onChange={setBodyContent} menuBarStickyTop='-24px' />
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

            {trackFollowUp && (
              <>
                <Separator />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('follow_up_section_title')}
                </p>

                <div className="flex items-start gap-3">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{t('follow_up_value_label')}</span>
                    <InputGroup>
                      <InputGroupInput
                        type="number"
                        placeholder="24"
                        {...register('follow_up_value')}
                      />
                      <InputGroupAddon align="inline-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <InputGroupButton
                              variant="ghost"
                              className="pr-1.5! text-xs"
                            >
                              {followUpUnitLabel}
                              <ChevronDownIcon className="size-3" />
                            </InputGroupButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={8} alignOffset={-4}>
                            {FOLLOW_UP_UNIT_OPTIONS.map((option) => (
                              <DropdownMenuItem
                                key={option.value}
                                onSelect={() => setValue('follow_up_unit', option.value, { shouldDirty: true })}
                              >
                                {option.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </InputGroupAddon>
                    </InputGroup>
                  </div>

                  <div className="flex-1">
                    <FormSelect
                      control={control}
                      name="reminder_count"
                      label={t('reminder_count_label')}
                      options={REMINDER_COUNT_OPTIONS}
                    />
                  </div>
                </div>

                <FormInput
                  control={control}
                  name="reminder_subject"
                  label={t('reminder_subject_label')}
                  placeholder={t('reminder_subject_placeholder')}
                />

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{t('reminder_body_label')}</span>
                  <Tiptap key={`${node?.id}-reminder`} value={reminderBodyContent} onChange={setReminderBodyContent} menuBarStickyTop='-24px' />
                </div>
              </>
            )}

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
