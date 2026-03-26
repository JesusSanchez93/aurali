'use client';

import { z } from 'zod';
import { useTransition, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { FormInput } from '@/components/common/form/form-input';
import { Spinner } from '@/components/ui/spinner';
import { ArrowRight } from 'lucide-react';
import { ViewTransition } from 'react';
import { deleteImageAction, updatePersonalDataAction } from '../actions';
import { useParams, useRouter } from 'next/navigation';
import { FormSelect } from '@/components/common/form/form-select';
import { FormImageUpload } from '@/components/common/form/form-image-upload';
import { useLegalProcessClientData, useLegalProcessDocumentTypes, useLegalProcessId } from '@/app/[locale]/(public)/legal-process/client-side/[id]/_context/LegalProcessClientSideProvider';
import { ConfirmDialog } from '@/components/common/confirm-dialog';

const formSchema = z.object({
  document_front_image: z.any().refine((val) => (val instanceof File && val.size > 0) || (typeof val === 'string' && val.length > 0), 'Required field'),
  document_back_image: z.any().refine((val) => (val instanceof File && val.size > 0) || (typeof val === 'string' && val.length > 0), 'Required field'),
  document_id: z
    .string({ required_error: 'Required field' })
    .trim()
    .min(1, 'Required field'),
  document_number: z
    .string({ required_error: 'Required field' })
    .trim()
    .min(1, 'Required field'),
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

export default function PersonalDataForm() {
  const initialData = useLegalProcessClientData();
  const id = useLegalProcessId();
  const router = useRouter();
  const documentTypes = useLegalProcessDocumentTypes();
  const [isPending, startTransition] = useTransition();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<'document_front_image' | 'document_back_image' | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { // Keep defaultValues for initial render, useEffect will handle updates
      firstname: initialData?.first_name || '',
      lastname: initialData?.last_name || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      document_id: initialData?.document_id || '',
      document_number: initialData?.document_number || '',
      document_front_image: initialData?.document_front_image || undefined,
      document_back_image: initialData?.document_back_image || undefined,
    },
  });

  useEffect(() => {
    if (!initialData || form.formState.isDirty) return;
    form.reset({
      firstname: initialData.first_name || '',
      lastname: initialData.last_name || '',
      email: initialData.email || '',
      phone: initialData.phone || '',
      document_id: initialData.document_id || '',
      document_number: initialData.document_number || '',
      document_front_image: initialData.document_front_image || undefined,
      document_back_image: initialData.document_back_image || undefined,
    });
  }, [initialData, form]); // form.formState.isDirty is not strictly needed in the dep array if we check it inside, but it helps. Actually form is stable, but initialData changes.

  function onSubmit(values: z.infer<typeof formSchema>) {
    const formData = new FormData();
    formData.append('firstname', values.firstname);
    formData.append('lastname', values.lastname);
    formData.append('email', values.email);
    formData.append('phone', values.phone);
    formData.append('document_id', values.document_id);
    formData.append('document_number', values.document_number);

    if (values.document_front_image instanceof File) {
      formData.append('document_front_image', values.document_front_image);
    } else if (typeof values.document_front_image === 'string') {
      formData.append('document_front_image_keep', 'true');
    }

    if (values.document_back_image instanceof File) {
      formData.append('document_back_image', values.document_back_image);
    } else if (typeof values.document_back_image === 'string') {
      formData.append('document_back_image_keep', 'true');
    }

    startTransition(async () => {
      await updatePersonalDataAction(id, formData);
      router.refresh();
      form.reset(values); // Mark as not dirty to allow next context sync
      router.push(`/legal-process/client-side/${id}/back-information`);
    });
  }

  const handleDeleteClick = (fieldName: 'document_front_image' | 'document_back_image') => {
    const value = form.getValues(fieldName);
    const isStoredImage = typeof value === 'string';

    if (isStoredImage) {
      setFieldToDelete(fieldName);
      setIsConfirmOpen(true);
    } else {
      form.setValue(fieldName, null);
    }
  };

  const onConfirmDelete = async () => {
    if (!fieldToDelete) return;

    startTransition(async () => {
      try {
        await deleteImageAction(id, fieldToDelete);
        // Limpiamos explícitamente el campo en el formulario y lo marcamos como sucio
        form.setValue(fieldToDelete, null, { shouldDirty: true, shouldValidate: true });
        router.refresh();
      } catch (error) {
        console.error('Error deleting image:', error);
      } finally {
        setIsConfirmOpen(false);
        setFieldToDelete(null);
      }
    });
  };

  return (
    <div className="w-full max-w-screen-sm space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-6">
            <FormSelect
              name="document_id"
              label="Tipo de documento"
              control={form.control}
              options={documentTypes.map((doc) => ({ label: doc.name, value: doc.id }))}
              size='xl'
              disabled
            />
            <FormInput
              control={form.control}
              name="document_number"
              label="Numero de documento"
              size='xl'
              disabled
            />

            <div className="grid grid-cols-2 gap-6">
              <FormImageUpload
                control={form.control}
                name="document_front_image"
                label="Imagen frontal"
                onDeleteClick={() => handleDeleteClick('document_front_image')}
              />
              <FormImageUpload
                control={form.control}
                name="document_back_image"
                label="Imagen trasera"
                onDeleteClick={() => handleDeleteClick('document_back_image')}
              />
            </div>

            <FormInput
              control={form.control}
              name="firstname"
              label="Nombres"
              size='xl'
            />
            <FormInput
              control={form.control}
              name="lastname"
              label="Apellidos"
              size='xl'
            />
            <FormInput
              control={form.control}
              name="email"
              label="Email"
              type="email"
              size='xl'
              disabled
            />
            <FormInput
              control={form.control}
              type="phone"
              name="phone"
              label="Teléfono"
              size='xl'
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

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={onConfirmDelete}
        title="¿Eliminar imagen?"
        description="Esta acción eliminará la imagen permanentemente del sistema de archivos y de la base de datos. ¿Estás seguro?"
        confirmLabel="Eliminar"
        variant="destructive"
      />
    </div>
  );
}
