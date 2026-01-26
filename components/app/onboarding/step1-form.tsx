'use client';

import { z } from 'zod';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { FormInput } from '@/components/common/form/form-input';
import { Spinner } from '@/components/ui/spinner';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { ViewTransition } from 'react';
import { updateProfileAction } from '@/app/onboarding/actions';

const formSchema = z.object({
  firstname: z
    .string({ required_error: 'Required field' })
    .trim()
    .min(1, 'Required field'),
  lastname: z
    .string({ required_error: 'Required field' })
    .trim()
    .min(1, 'Required field'),
  email: z
    .string({ required_error: 'Required field' })
    .trim()
    .email('Invalid email format')
    .min(1, 'Required field'),
  phone: z
    .string({ required_error: 'Required field' })
    .trim()
    .min(1, 'Required field'),
});

type Props = {
  profile: z.infer<typeof formSchema>;
};

export default function Step1Form({ profile }: Props) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: profile,
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
      await updateProfileAction({
        ...values,
        onboarding_status: 'step1_completed',
      });
      redirect('/onboarding/step2');
    });
  }

  return (
    <div className="w-full max-w-screen-sm space-y-4">
      <ViewTransition name="onboarding-form-header">
        <div className="mb-12">
          <span className="text-2xl">
            Paso 1 de 2: Datos personales del Usuario
          </span>
        </div>
      </ViewTransition>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormInput
              control={form.control}
              name="firstname"
              label="Nombres"
            />
            <FormInput
              control={form.control}
              name="lastname"
              label="Apellidos"
            />
            <FormInput
              control={form.control}
              name="email"
              label="Email"
              type="email"
            />
            <FormInput
              control={form.control}
              type="phone"
              name="phone"
              label="Teléfono"
            />
          </div>
          <ViewTransition name="onboarding-form-footer">
            <div className="mt-6 flex justify-end">
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
