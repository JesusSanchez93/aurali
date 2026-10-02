'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useTransition, useMemo, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from '@/lib/toast';
import { FormSelect } from '@/components/common/form/form-select';
import { useTranslations } from 'next-intl';
import { FormInput } from '@/components/common/form/form-input';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { DynamicSectionFields } from '@/components/common/dynamic-form/DynamicSectionFields';
import { buildZodSchema } from '@/lib/forms/buildZodSchema';
import type { FormFieldSchema } from '@/lib/forms/types';
import { createLegalProcessDraft, getLawyerFilledSections, type LawyerFilledSection } from '../actions';


type Lawyer = { id: string; firstname: string | null; lastname: string | null; email: string | null };
type WorkflowTemplateOption = { id: string; name: string; is_legacy_form: boolean };

interface Props {
  documents: { label: string; value: string; key?: string }[];
  lawyers: Lawyer[];
  workflowTemplates: WorkflowTemplateOption[];
  currentUserId: string;
  onSuccess?: () => void;
}

const stepVariants = {
  enter: { x: 24, opacity: 0 },
  center: { x: 0, opacity: 1, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const } },
  exit: { x: -24, opacity: 0, transition: { duration: 0.16, ease: 'easeIn' as const } },
};

export default function ProcessForm({ documents, lawyers, workflowTemplates, currentUserId, onSuccess }: Props) {
  const commonT = useTranslations('common');
  const processT = useTranslations('process');
  const validationT = useTranslations('common.validation');

  const [isPending, startTransition] = useTransition();
  const [loadingFields, setLoadingFields] = useState(false);

  // El selector de tipo de proceso solo se muestra (y es requerido) cuando la
  // organización tiene más de un workflow_template activo; con uno solo se
  // usa automáticamente y el paso 1 se salta.
  const showWorkflowTemplateSelector = workflowTemplates.length > 1;
  const [step, setStep] = useState<'type' | 'details'>(showWorkflowTemplateSelector ? 'type' : 'details');
  const [lawyerSections, setLawyerSections] = useState<LawyerFilledSection[]>([]);

  const lawyerFields = useMemo(
    () => lawyerSections.flatMap((s) => s.fields),
    [lawyerSections],
  );

  const formSchema = useMemo(() => {
    const base = z.object({
      document_id: z.string().min(1, validationT('required')),
      document_number: z.string().min(1, validationT('required')),
      email: z
        .string({ required_error: validationT('required') })
        .trim()
        .email(validationT('invalid_email'))
        .min(1, validationT('required')),
      assigned_to: z.string().min(1, validationT('required')),
      workflow_template_id: showWorkflowTemplateSelector
        ? z.string().min(1, validationT('required'))
        : z.string().optional(),
    });
    return base.merge(buildZodSchema(lawyerFields));
  }, [validationT, showWorkflowTemplateSelector, lawyerFields]);

  const lawyerOptions = lawyers.map((l) => ({
    value: l.id,
    label: [l.firstname, l.lastname].filter(Boolean).join(' ') || l.email || l.id,
  }));

  const workflowTemplateOptions = workflowTemplates.map((wf) => ({
    value: wf.id,
    label: wf.name,
  }));

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      document_id: '',
      document_number: '',
      assigned_to: currentUserId,
      workflow_template_id: showWorkflowTemplateSelector ? '' : (workflowTemplates[0]?.id ?? ''),
    },
  });

  const selectedWorkflowId = form.watch('workflow_template_id') ?? '';

  async function loadLawyerFields(workflowTemplateId: string) {
    setLoadingFields(true);
    try {
      const result = await getLawyerFilledSections(workflowTemplateId);
      setLawyerSections(result?.sections ?? []);
    } catch {
      setLawyerSections([]);
    } finally {
      setLoadingFields(false);
    }
  }

  // Organización con un solo workflow activo: carga los campos del abogado
  // de una vez, sin pasar por el paso 1 (nunca hay nada que seleccionar).
  useEffect(() => {
    if (!showWorkflowTemplateSelector && selectedWorkflowId) {
      void loadLawyerFields(selectedWorkflowId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleContinue() {
    if (!selectedWorkflowId) return;
    void loadLawyerFields(selectedWorkflowId).then(() => setStep('details'));
  }

  function handleBack() {
    setStep('type');
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
      try {
        const document = documents?.find(e => e.value === values.document_id);
        if (!document) return;

        const { label, key } = document;

        // El merge de zod con buildZodSchema(lawyerFields) (shape genérico
        // Record<string, ZodTypeAny>) hace que z.infer pierda los tipos
        // específicos de los campos base — se castea de vuelta a lo que
        // realmente es en runtime.
        const v = values as unknown as {
          document_id: string;
          document_number: string;
          email: string;
          assigned_to: string;
        } & Record<string, unknown>;

        const lawyerFieldValues: Record<string, unknown> = {};
        for (const field of lawyerFields) {
          lawyerFieldValues[field.key] = v[field.key];
        }

        await createLegalProcessDraft({
          document_id: v.document_id,
          document_number: v.document_number,
          email: v.email,
          assigned_to: v.assigned_to,
          workflow_template_id: selectedWorkflowId || undefined,
          document_type: label ?? '',
          document_slug: key ?? '',
          lawyer_field_values: lawyerFieldValues,
        });

        form.reset();
        toast.success(processT('form.success_toast'), {
          description: processT('form.success_desc'),
        });
        onSuccess?.();
      } catch (error) {
        console.error(error);
        toast.error(processT('form.error_toast'), {
          description:
            error instanceof Error ? error.message : commonT('error_fallback'),
        });
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {step === 'type' ? (
              <motion.div key="type" variants={stepVariants} initial="enter" animate="center" exit="exit">
                <div className="grid grid-cols-1 gap-4">
                  <FormSelect
                    control={form.control}
                    name="workflow_template_id"
                    label={processT('fields.workflow_template')}
                    className="flex-auto"
                    required
                    options={workflowTemplateOptions}
                  />
                  <Button
                    type="button"
                    className="mt-2"
                    disabled={!selectedWorkflowId || loadingFields}
                    onClick={handleContinue}
                  >
                    {loadingFields && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {processT('form.continue')}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="details" variants={stepVariants} initial="enter" animate="center" exit="exit">
                <div className="grid grid-cols-1 gap-4">
                  {showWorkflowTemplateSelector && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="-ml-2 w-fit text-muted-foreground"
                      onClick={handleBack}
                    >
                      <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                      {processT('form.back')}
                    </Button>
                  )}
                  <FormSelect
                    control={form.control}
                    name="document_id"
                    label={processT('fields.document_type')}
                    className="flex-auto"
                    required
                    disabled={isPending}
                    options={documents}
                  />
                  <FormInput
                    control={form.control}
                    name="document_number"
                    label={processT('fields.document_number')}
                    className="flex-auto"
                    required
                    disabled={isPending}
                  />
                  <FormInput
                    control={form.control}
                    name="email"
                    label={processT('fields.email')}
                    type="email"
                    className="flex-auto"
                    required
                    disabled={isPending}
                  />
                  <FormSelect
                    control={form.control}
                    name="assigned_to"
                    label={processT('fields.assigned_to')}
                    className="flex-auto"
                    required
                    disabled={isPending}
                    options={lawyerOptions}
                  />
                  {lawyerSections.map((section) => (
                    <div key={section.sectionKey} className="space-y-3 border-t pt-4">
                      <p className="text-sm font-medium text-muted-foreground">{section.sectionTitle}</p>
                      <DynamicSectionFields
                        control={form.control as never}
                        fields={section.fields as FormFieldSchema[]}
                        disabled={isPending}
                      />
                    </div>
                  ))}

                  <Button type="submit" disabled={isPending} className="mt-5">
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isPending ? processT('form.submitting') : processT('form.submit')}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </form>
    </Form>
  );
}
