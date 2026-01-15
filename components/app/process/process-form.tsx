'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod'; // Import z correctly
import { FormInput } from '../../common/form/form-input';
import { Button } from '../../ui/button';
import { useForm } from 'react-hook-form';
import { Form } from '../../ui/form';
import { useTransition } from 'react';
import { createClientDraft } from '@/app/(dashboard)/process/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  email: z
    .string({ required_error: 'Required field' })
    .trim()
    .email('Invalid email format')
    .min(1, 'Required field'),
});

export default function ProcessForm() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
      try {
        await createClientDraft(values);
        form.reset();
        toast({
          title: 'Process started',
          description: 'New process has been successfully created.',
        });
      } catch (error) {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Something went wrong',
        });
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="w-full gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
          <div className="mb-4 text-lg font-medium tracking-tight">
            Envía formulario al cliente para iniciar el proceso.
          </div>
          <div className="flex items-end gap-4">
            <FormInput
              control={form.control}
              name="email"
              label="Email"
              type="email"
              className="flex-auto"
              required
              disabled={isPending}
            />
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? 'Iniciando...' : 'Iniciar proceso'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
