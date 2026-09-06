'use client';

import { useEffect, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import Sheet from '@/components/common/sheet';
import { Form } from '@/components/ui/form';
import { FormInput } from '@/components/common/form/form-input';
import { FormSelect } from '@/components/common/form/form-select';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/lib/toast';
import { Database } from '@/types/database.types';
import {
  createClientRecord,
  updateClientRecord,
  type DocumentTypeOption,
} from '@/app/[locale]/(dashboard)/clients/actions';

type Client = Database['public']['Tables']['clients']['Row'];

const clientSchema = z.object({
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  document_slug: z.string().optional().or(z.literal('')),
  document_number: z.string().trim().optional().or(z.literal('')),
  address: z.string().trim().optional().or(z.literal('')),
});

type ClientValues = z.infer<typeof clientSchema>;

interface Props {
  client?: Client | null;
  documentTypes: DocumentTypeOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function ClientFormSheet({ client, documentTypes, open, onOpenChange, onSaved }: Props) {
  const t = useTranslations('clients.form');
  const processT = useTranslations('process.fields');
  const commonT = useTranslations('common');
  const router = useRouter();
  const [isSubmitting, startSubmit] = useTransition();

  const isEditing = !!client;

  const form = useForm<ClientValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      document_slug: '',
      document_number: '',
      address: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      first_name: client?.first_name ?? '',
      last_name: client?.last_name ?? '',
      email: client?.email ?? '',
      phone: client?.phone ?? '',
      document_slug: client?.document_slug ?? '',
      document_number: client?.document_number ?? '',
      address: client?.address ?? '',
    });
  }, [open, client, form]);

  function handleSubmit(values: ClientValues) {
    startSubmit(async () => {
      try {
        const input = {
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email || null,
          phone: values.phone || null,
          document_slug: values.document_slug || null,
          document_number: values.document_number || null,
          address: values.address || null,
        };

        if (isEditing) {
          await updateClientRecord(client.id, input);
          toast.success(t('update_success'));
        } else {
          await createClientRecord(input);
          toast.success(t('create_success'));
        }

        onOpenChange(false);
        onSaved?.();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('error'));
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      trigger={<span />}
      title={isEditing ? t('edit_title') : t('new_title')}
      body={
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="w-full space-y-4 p-4 pt-0">
            <div className="grid grid-cols-2 gap-4">
              <FormInput control={form.control} name="first_name" label={processT('first_name')} required disabled={isSubmitting} />
              <FormInput control={form.control} name="last_name" label={processT('last_name')} required disabled={isSubmitting} />
              <FormInput control={form.control} name="email" type="email" label={processT('email')} disabled={isSubmitting} />
              <FormInput control={form.control} name="phone" type="phone" label={processT('phone')} disabled={isSubmitting} />
              <FormSelect
                control={form.control}
                name="document_slug"
                label={processT('document_type')}
                placeholder={t('field_document_type_placeholder')}
                disabled={isSubmitting}
                options={documentTypes.map((d) => ({ label: d.label, value: d.slug }))}
              />
              <FormInput control={form.control} name="document_number" label={processT('document_number')} disabled={isSubmitting} />
            </div>
            <FormInput control={form.control} name="address" label={t('field_address')} disabled={isSubmitting} />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Spinner className="h-4 w-4" /> : isEditing ? commonT('save') : t('create')}
            </Button>
          </form>
        </Form>
      }
    />
  );
}
