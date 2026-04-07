'use client';

import { z } from 'zod';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { FormOtp } from '@/components/common/form/form-otp';
import { Spinner } from '@/components/ui/spinner';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { ViewTransition } from 'react';
import { updateBankingInformationAction } from '@/app/[locale]/(public)/legal-process/client-side/[id]/[step]/actions';
import { FormSelect } from '@/components/common/form/form-select';
import { FormFileUpload } from '@/components/common/form/form-file-upload';
import { useLegalProcessBankingData, useLegalProcessId, useLegalProcessBanks } from '@/app/[locale]/(public)/legal-process/client-side/[id]/_context/LegalProcessClientSideProvider';
import { useRouter } from 'next/navigation';

const formSchema = z.object({
  bank_id: z
    .string({ required_error: 'Required field' })
    .trim()
    .min(1, 'Required field'),
  last_4_digits: z
    .string({ required_error: 'Required field' })
    .length(4, 'Ingresa exactamente 4 dígitos')
    .regex(/^\d+$/, 'Solo se permiten dígitos'),
  file_complait: z
    .boolean({ required_error: 'Required field' })
    .default(false),
  bank_request: z
    .any()
    .optional(),
  bank_response: z
    .any()
    .optional(),
  latest_account_statement: z
    .any()
    .optional()

});

export default function BankingInformationForm() {
  const initialData = useLegalProcessBankingData();
  const banks = useLegalProcessBanks();
  const id = useLegalProcessId();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const bankOptions = banks.map(bank => ({ label: bank.name, value: bank.id }));

  console.log({ bankOptions, banks });


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bank_id: initialData?.bank_id ?? '',
      last_4_digits: initialData?.last_4_digits ?? '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const formData = new FormData();
    formData.append('bank_id', values.bank_id);
    formData.append('last_4_digits', values.last_4_digits);

    const selectedBank = banks.find(b => b.id === values.bank_id);
    if (selectedBank) {
      formData.append('bank_name', selectedBank.name);
      formData.append('bank_slug', selectedBank.slug ?? '');
    }

    if (values.bank_request?.file instanceof File) {
      formData.append('bank_request', values.bank_request.file);
    }

    if (Array.isArray(values.bank_response)) {
      values.bank_response.forEach((item) => {
        if (item.file instanceof File) {
          formData.append('bank_response', item.file);
        }
      });
    }

    if (Array.isArray(values.latest_account_statement)) {
      values.latest_account_statement.forEach((item) => {
        if (item.file instanceof File) {
          formData.append('latest_account_statement', item.file);
        }
      });
    }

    startTransition(async () => {
      try {
        await updateBankingInformationAction(id, formData);
        router.refresh();
        router.push(`/legal-process/client-side/${id}/info-events`);
      } catch (error) {
        console.error('Error saving banking information:', error);
      }
    });
  }

  return (
    <div className="w-full max-w-screen-sm space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-6">
            <FormSelect
              control={form.control}
              name="bank_id"
              label="Banco"
              options={bankOptions}
              size='xl'
              required
            />
            <FormOtp
              control={form.control}
              name="last_4_digits"
              label="Últimos cuatro dígitos del producto"
              required
            />
            <FormFileUpload
              control={form.control}
              name="bank_request"
              label="Solicitud a la entidad financiera"
              accept=".pdf"
              description="Sube el documento de solicitud en formato PDF."
            />
            <FormFileUpload
              control={form.control}
              name="bank_response"
              label="Respuesta de la entidad financiera"
              accept=".pdf"
              multiple={true}
              maxFiles={3}
              description="Sube hasta 3 respuestas en formato PDF."
            />
            <FormFileUpload
              control={form.control}
              name="latest_account_statement"
              label="Último extracto bancario"
              accept=".pdf"
              multiple={true}
              maxFiles={3}
              description="Sube hasta 3 respuestas en formato PDF."
            />
          </div>
          <ViewTransition name="onboarding-form-footer">
            <div className="mt-6 flex justify-between">
              <Button
                type="button"
                disabled={isPending}
                variant="outline"
                size="icon"
                className="rounded-full"
                onClick={() => router.push(`/legal-process/client-side/${id}/personal-data`)}
              >
                <ArrowLeft />
              </Button>

              <Button
                type="submit"
                disabled={isPending}
                variant="outline"
                size="icon"
                className="rounded-full"
              >
                {!isPending ? <ArrowRight /> : <Spinner />}
              </Button>
            </div>
          </ViewTransition>
        </form>
      </Form>
    </div>
  );
}
