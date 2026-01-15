'use client';

import { z } from 'zod';
import { useTransition, ViewTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { FormInput } from '@/components/common/form/form-input';
import { Spinner } from '@/components/ui/spinner';
import { redirect } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { createOrganization } from '@/app/onboarding/actions';

const formSchema = z.object({
  name: z
    .string({ required_error: 'Required field' })
    .trim()
    .min(1, 'Required field'),
  legal_name: z
    .string({ required_error: 'Required field' })
    .trim()
    .min(1, 'Required field'),
  nit: z
    .string({ required_error: 'Required field' })
    .trim()
    .min(1, 'Required field'),
  address: z
    .string({ required_error: 'Required field' })
    .trim()
    .min(1, 'Required field'),
  city: z
    .string({ required_error: 'Required field' })
    .trim()
    .min(1, 'Required field'),
  country: z
    .string({ required_error: 'Required field' })
    .trim()
    .min(1, 'Required field'),
});

export default function Step2Form() {
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      legal_name: '',
      nit: '',
      address: '',
      city: '',
      country: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
      await createOrganization({
        ...values,
        onboarding_status: 'completed',
      });
      redirect('/');
    });
  }

  return (
    <div className="w-full max-w-screen-sm space-y-4">
      <ViewTransition name="onboarding-form-header">
        <div className="mb-12">
          <span className="text-2xl">
            Paso 2 de 2: Datos de la organización
          </span>
        </div>
      </ViewTransition>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormInput
              control={form.control}
              name="name"
              label="Nombres"
              required
            />
            <FormInput
              control={form.control}
              name="legal_name"
              label="Legal name"
              required
            />
            <FormInput control={form.control} name="nit" label="Nit" required />
            <FormInput
              control={form.control}
              name="address"
              label="Address"
              required
            />
            <FormInput
              control={form.control}
              name="country"
              label="Country"
              required
            />
            <FormInput
              control={form.control}
              name="city"
              label="City"
              required
            />
          </div>
          <ViewTransition name="onboarding-form-footer">
            <div className="mt-6">
              <div className="mt-6 flex justify-between">
                <Button
                  type="button"
                  disabled={isPending}
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  asChild
                >
                  <Link href="/onboarding/step1">
                    <ArrowLeft />
                  </Link>
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
            </div>
          </ViewTransition>
        </form>
      </Form>
    </div>
  );
}
