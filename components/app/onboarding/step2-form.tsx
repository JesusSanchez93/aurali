'use client';

import { z } from 'zod';
import { useTransition, useMemo } from 'react';
import { ViewTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { FormInput } from '@/components/common/form/form-input';
import { CountrySelector } from '@/components/ui/country-selector';
import { RegionSelector } from '@/components/ui/region-selector';
import { CitySelector } from '@/components/ui/city-selector';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Spinner } from '@/components/ui/spinner';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { updateFirstOrganization } from '@/app/[locale]/onboarding/actions';
import { useTranslations } from 'next-intl';

export default function Step2Form() {
  const t = useTranslations('onboarding.step2');
  const fieldsT = useTranslations('onboarding.fields');
  const processFieldsT = useTranslations('process.fields');
  const validationT = useTranslations('common.validation');
  const router = useRouter();

  const [isPending, startTransition] = useTransition();

  const formSchema = useMemo(() => z.object({
    name: z
      .string({ required_error: validationT('required') })
      .trim()
      .min(1, validationT('required')),
    legal_name: z
      .string({ required_error: validationT('required') })
      .trim()
      .min(1, validationT('required')),
    nit: z
      .string({ required_error: validationT('required') })
      .trim()
      .min(1, validationT('required')),
    address: z
      .string({ required_error: validationT('required') })
      .trim()
      .min(1, validationT('required')),
    country: z
      .string({ required_error: validationT('required') })
      .trim()
      .min(1, validationT('required')),
    region: z
      .string({ required_error: validationT('required') })
      .trim()
      .min(1, validationT('required')),
    city: z
      .string({ required_error: validationT('required') })
      .trim()
      .min(1, validationT('required')),
  }), [validationT]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      legal_name: '',
      nit: '',
      address: '',
      country: 'CO',
      region: '',
      city: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
      await updateFirstOrganization({
        name: values.name,
        legal_name: values.legal_name,
        nit: values.nit,
        address: values.address,
        country: values.country,
        region: values.region,
        city: values.city,
        onboarding_status: 'step2_completed',
      });
      router.push('/onboarding/step3');
    });
  }

  return (
    <div className="w-full max-w-screen-sm space-y-4">
      <ViewTransition name="onboarding-form-header">
        <div className="mb-12">
          <span className="text-2xl">
            {t('title')}
          </span>
        </div>
      </ViewTransition>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormInput
              control={form.control}
              name="name"
              label={processFieldsT('first_name')}
              required
            />
            <FormInput
              control={form.control}
              name="legal_name"
              label={fieldsT('legal_name')}
              required
            />
            <FormInput control={form.control} name="nit" label={fieldsT('nit')} required />
            <FormInput
              control={form.control}
              name="address"
              label={fieldsT('address')}
              required
            />
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{fieldsT('country')}</FormLabel>
                  <CountrySelector
                    value={field.value}
                    onChange={(val) => {
                      field.onChange(val);
                      form.setValue('region', '');
                      form.setValue('city', '');
                    }}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{fieldsT('region')}</FormLabel>
                  <RegionSelector
                    countryCode={form.watch('country')}
                    value={field.value}
                    onChange={(val) => {
                      field.onChange(val);
                      form.setValue('city', '');
                    }}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{fieldsT('city')}</FormLabel>
                  <CitySelector
                    countryCode={form.watch('country')}
                    stateName={form.watch('region')}
                    value={field.value}
                    onChange={field.onChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
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
