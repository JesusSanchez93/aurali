'use client';

import { z } from 'zod';
import { useTransition, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { FormInput } from '@/components/common/form/form-input';
import { FormSelect } from '@/components/common/form/form-select';
import { Spinner } from '@/components/ui/spinner';
import { ArrowRight } from 'lucide-react';
import { ViewTransition } from 'react';
import { updateProfileAction } from '@/app/[locale]/onboarding/actions';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

type Props = {
  isInvited?: boolean;
  documentTypeOptions: { value: string; label: string }[];
  profile: {
    firstname: string;
    lastname: string;
    email: string;
    phone: string;
    document_type: string;
    document_number: string;
    professional_card_number: string | null;
  };
};

export default function Step1Form({ profile, isInvited = false, documentTypeOptions }: Props) {
  const t = useTranslations('onboarding.step1');
  const processT = useTranslations('process.fields');
  const validationT = useTranslations('common.validation');
  const router = useRouter();

  const [isPending, startTransition] = useTransition();

  const formSchema = useMemo(() => z.object({
    firstname: z
      .string({ required_error: validationT('required') })
      .trim()
      .min(1, validationT('required')),
    lastname: z
      .string({ required_error: validationT('required') })
      .trim()
      .min(1, validationT('required')),
    email: z
      .string({ required_error: validationT('required') })
      .trim()
      .email(validationT('invalid_email'))
      .min(1, validationT('required')),
    phone: z
      .string({ required_error: validationT('required') })
      .trim()
      .min(1, validationT('required')),
    document_type: z
      .string({ required_error: validationT('required') })
      .trim()
      .min(1, validationT('required')),
    document_number: z
      .string({ required_error: validationT('required') })
      .trim()
      .min(1, validationT('required')),
    professional_card_number: z.string().trim().optional(),
  }), [validationT]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstname: profile.firstname || '',
      lastname: profile.lastname || '',
      email: profile.email || '',
      phone: profile.phone || '',
      document_type: profile.document_type || '',
      document_number: profile.document_number || '',
      professional_card_number: profile.professional_card_number ?? '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
      await updateProfileAction({
        first_name: values.firstname,
        last_name: values.lastname,
        email: values.email,
        phone: values.phone,
        document_type: values.document_type,
        document_number: values.document_number,
        professional_card_number: values.professional_card_number || undefined,
        onboarding_status: isInvited ? 'completed' : 'step1_completed',
      });
      router.push(isInvited ? '/dashboard' : '/onboarding/step2');
    });
  }

  return (
    <div className="w-full max-w-screen-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <ViewTransition name="onboarding-form-header">
        <div className="mb-8">
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Paso 1 · Perfil
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        </div>
      </ViewTransition>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FormInput
              control={form.control}
              name="firstname"
              label={processT('first_name')}
            />
            <FormInput
              control={form.control}
              name="lastname"
              label={processT('last_name')}
            />
            <FormInput
              control={form.control}
              name="email"
              label={processT('email')}
              type="email"
              disabled
            />
            <FormInput
              control={form.control}
              type="phone"
              name="phone"
              label={processT('phone')}
            />
            <FormSelect
              control={form.control}
              name="document_type"
              label={processT('document_type')}
              options={documentTypeOptions}
            />
            <FormInput
              control={form.control}
              name="document_number"
              label={processT('document_number')}
            />
            <FormInput
              control={form.control}
              name="professional_card_number"
              label={processT('professional_card_number')}
            />
          </div>

          <ViewTransition name="onboarding-form-footer">
            <div className="sticky bottom-0 z-10 mt-8 flex justify-end bg-background/80 py-4 backdrop-blur-sm">
              <Button
                type="submit"
                disabled={isPending}
                variant="outline"
                size="icon"
                className="rounded-full"
              >
                {isPending ? <Spinner /> : <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </ViewTransition>
        </form>
      </Form>
    </div>
  );
}
