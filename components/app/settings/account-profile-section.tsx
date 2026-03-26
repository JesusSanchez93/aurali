'use client';

import { z } from 'zod';
import { useTransition, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/common/form/form-input';
import { FormSelect } from '@/components/common/form/form-select';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, User, Building2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { updateAccountProfile } from '@/app/[locale]/(dashboard)/account/actions';
import { toast } from 'sonner';

type Membership = {
  orgId: string;
  orgName: string;
  role: string;
  active: boolean;
};

type Props = {
  profile: {
    firstname: string;
    lastname: string;
    email: string;
    phone: string;
    document_type: string;
    document_number: string;
  };
  documentTypeOptions: { value: string; label: string }[];
  memberships: Membership[];
};

export default function AccountProfileSection({ profile, documentTypeOptions, memberships }: Props) {
  const processT = useTranslations('process.fields');
  const validationT = useTranslations('common.validation');
  const [isPending, startTransition] = useTransition();

  const schema = useMemo(() => z.object({
    firstname: z.string().trim().min(1, validationT('required')),
    lastname: z.string().trim().min(1, validationT('required')),
    phone: z.string().trim().min(1, validationT('required')),
    document_type: z.string().trim().min(1, validationT('required')),
    document_number: z.string().trim().min(1, validationT('required')),
  }), [validationT]);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstname: profile.firstname,
      lastname: profile.lastname,
      phone: profile.phone,
      document_type: profile.document_type,
      document_number: profile.document_number,
    },
  });

  function onSubmit(values: z.infer<typeof schema>) {
    startTransition(async () => {
      try {
        await updateAccountProfile(values);
        toast.success('Perfil actualizado');
      } catch {
        toast.error('Error al actualizar el perfil');
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Personal data */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Datos personales</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <div className="space-y-1">
                <label className="text-sm font-medium">{processT('email')}</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="h-9 w-full rounded-md border bg-muted px-3 text-sm opacity-60"
                />
              </div>
              <FormInput
                control={form.control}
                name="phone"
                type="phone"
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
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
                Guardar cambios
              </Button>
            </div>
          </form>
        </Form>
      </section>

      {/* Organizations */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Organizaciones</h2>
        {memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin organizaciones.</p>
        ) : (
          <div className="space-y-2">
            {memberships.map((m) => (
              <div
                key={m.orgId}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{m.orgName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={m.role === 'ORG_ADMIN' ? 'default' : 'secondary'} className="gap-1">
                    {m.role === 'ORG_ADMIN' ? (
                      <ShieldCheck className="h-3 w-3" />
                    ) : (
                      <User className="h-3 w-3" />
                    )}
                    {m.role === 'ORG_ADMIN' ? 'Admin' : 'Usuario'}
                  </Badge>
                  {!m.active && (
                    <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
