'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useTransition, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormSelect } from '@/components/common/form/form-select';
import { useTranslations } from 'next-intl';
import { FormInput } from '@/components/common/form/form-input';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { createLegalProcessDraft } from '../actions';


type Lawyer = { id: string; firstname: string | null; lastname: string | null; email: string | null };

interface Props {
  documents: { label: string; value: string; key?: string }[];
  lawyers: Lawyer[];
  currentUserId: string;
  onSuccess?: () => void;
}

export default function ProcessForm({ documents, lawyers, currentUserId, onSuccess }: Props) {
  const t = useTranslations();
  const commonT = useTranslations('common');
  const processT = useTranslations('process');
  const validationT = useTranslations('common.validation');

  const [isPending, startTransition] = useTransition();

  const formSchema = useMemo(() => z.object({
    document_id: z.string().min(1, validationT('required')),
    document_number: z.string().min(1, validationT('required')),
    email: z
      .string({ required_error: validationT('required') })
      .trim()
      .email(validationT('invalid_email'))
      .min(1, validationT('required')),
    assigned_to: z.string().min(1, validationT('required')),
  }), [validationT]);

  const lawyerOptions = lawyers.map((l) => ({
    value: l.id,
    label: [l.firstname, l.lastname].filter(Boolean).join(' ') || l.email || l.id,
  }));

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      document_id: '',
      document_number: '',
      assigned_to: currentUserId,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
      try {
        const document = documents?.find(e => e.value === values.document_id);
        if (!document) return;

        const { label, key } = document;

        await createLegalProcessDraft({
          ...values,
          document_type: label ?? '',
          document_slug: key ?? '',
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
        <div className="grid grid-cols-1 gap-4">
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
          <Button type="submit" disabled={isPending} className="mt-5">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending ? processT('form.submitting') : processT('form.submit')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
