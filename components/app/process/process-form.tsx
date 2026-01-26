'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod'; // Import z correctly
import { FormInput } from '../../common/form/form-input';
import { Button } from '../../ui/button';
import { useForm } from 'react-hook-form';
import { Form } from '../../ui/form';
import { useTransition } from 'react';
import { createLegalProcessDraft } from '@/app/(dashboard)/process/actions';
import { Loader2 } from 'lucide-react';
import { useProfile } from '@/components/providers/profile-provider';
import { toast } from 'sonner';

const formSchema = z.object({
  document_type: z.string().min(1, 'Required field'),
  document_number: z.string().min(1, 'Required field'),
  email: z
    .string({ required_error: 'Required field' })
    .trim()
    .email('Invalid email format')
    .min(1, 'Required field'),
});

interface Props {
  onSuccess?: () => void;
}
export default function ProcessForm({ onSuccess }: Props) {
  const { current_organization_id } = useProfile();
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      document_type: '',
      document_number: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
      try {
        await createLegalProcessDraft({
          ...values,
          current_organization_id,
        });
        form.reset();
        toast.success('Proceso creado', {
          description: 'El proceso ha sido creado exitosamente.',
        });
        onSuccess?.();
      } catch (error) {
        console.error(error);
        toast.error('Error', {
          description:
            error instanceof Error ? error.message : 'Something went wrong',
        });
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-4">
          <FormInput
            control={form.control}
            name="document_type"
            label="Tipo de documento"
            className="flex-auto"
            required
            disabled={isPending}
          />
          <FormInput
            control={form.control}
            name="document_number"
            label="Numero de documento"
            className="flex-auto"
            required
            disabled={isPending}
          />
          <FormInput
            control={form.control}
            name="email"
            label="Email"
            type="email"
            className="flex-auto"
            required
            disabled={isPending}
          />
          <Button type="submit" disabled={isPending} className="mt-5">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending ? 'Iniciando...' : 'Iniciar proceso'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
