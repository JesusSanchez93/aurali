'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { toast } from '@/lib/toast';
import { buildZodSchema } from '@/lib/forms/buildZodSchema';
import { encodeSectionFormData } from '@/lib/forms/formDataCodec';
import { DynamicSectionFields } from '@/components/common/dynamic-form/DynamicSectionFields';
import type { FormSection } from '@/lib/forms/types';
import { useLegalProcessId } from '../../_context/LegalProcessClientSideProvider';
import { submitSectionAction } from '../dynamic-actions';

interface Props {
  formSchemaId: string;
  section: FormSection;
  defaultValues: Record<string, unknown> | null;
  /** Sección previa a la que "Atrás" navega — ausente en la primera sección. */
  previousSectionKey?: string;
}

export function DynamicStepForm({ formSchemaId, section, defaultValues, previousSectionKey }: Props) {
  const legalProcessId = useLegalProcessId();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const resolver = zodResolver(buildZodSchema(section.fields));
  const form = useForm<Record<string, unknown>>({
    resolver,
    defaultValues: defaultValues ?? {},
  });

  function onSubmit(values: Record<string, unknown>) {
    startTransition(async () => {
      try {
        const formData = encodeSectionFormData(section.fields, values);
        const result = await submitSectionAction(legalProcessId, formSchemaId, section.key, formData);

        if (!result.success) {
          toast.error(result.error);
          return;
        }

        router.push(`/legal-process/client-side/${legalProcessId}/${result.nextSectionKey}`);
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'Error al enviar el formulario');
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4">
        <div>
          <h2 className="text-lg font-semibold">{section.title}</h2>
          {section.description && (
            <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
          )}
        </div>

        <DynamicSectionFields control={form.control} fields={section.fields} disabled={isPending} />

        <div className="flex justify-between">
          {previousSectionKey ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full"
              disabled={isPending}
              onClick={() => router.push(`/legal-process/client-side/${legalProcessId}/${previousSectionKey}`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continuar
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </form>
    </Form>
  );
}
