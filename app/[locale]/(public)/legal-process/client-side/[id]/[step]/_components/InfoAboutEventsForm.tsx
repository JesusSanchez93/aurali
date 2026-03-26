'use client';

import { z } from 'zod';
import { useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { FormInput } from '@/components/common/form/form-input';
import { Spinner } from '@/components/ui/spinner';
import { redirect } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { ViewTransition } from 'react';
import { updateInfoAboutEventsAction } from '@/app/[locale]/(public)/legal-process/client-side/[id]/[step]/actions';
import { FormSelect } from '@/components/common/form/form-select';
import { FormImageUpload } from '@/components/common/form/form-image-upload';
import { FormFileUpload } from '@/components/common/form/form-file-upload';
import { useLegalProcessBankingData, useLegalProcessId } from '@/app/[locale]/(public)/legal-process/client-side/[id]/_context/LegalProcessClientSideProvider';
import { useRouter } from 'next/navigation';
import { FormSwitch } from '@/components/common/form/form-switch';
import { FormTextarea } from '@/components/common/form/form-textarea';

const formSchema = z.object({
    file_complait: z
        .boolean({ required_error: 'Required field' })
        .default(false),
    no_signal: z
        .boolean({ required_error: 'Required field' })
        .default(false),
    bank_notification: z
        .boolean({ required_error: 'Required field' })
        .default(false),
    access_website: z
        .boolean({ required_error: 'Required field' })
        .default(false),
    access_link: z
        .boolean({ required_error: 'Required field' })
        .default(false),
    used_to_operate_stolen_amount: z
        .boolean({ required_error: 'Required field' })
        .default(false),
    lost_card: z
        .boolean({ required_error: 'Required field' })
        .default(false),
    fraud_incident_summary: z
        .string({ required_error: 'Required field' })
        .trim()
        .min(1, 'Required field'),
});

export default function InfoAboutEventsForm() {
    const initialData = useLegalProcessBankingData();
    const id = useLegalProcessId();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            file_complait: initialData?.file_complait ?? false,
            no_signal: initialData?.no_signal ?? false,
            bank_notification: initialData?.bank_notification ?? false,
            access_website: initialData?.access_website ?? false,
            access_link: initialData?.access_link ?? false,
            used_to_operate_stolen_amount: initialData?.used_to_operate_stolen_amount ?? false,
            lost_card: initialData?.lost_card ?? false,
            fraud_incident_summary: initialData?.fraud_incident_summary ?? '',
        },
    });

    useEffect(() => {
        if (!initialData || form.formState.isDirty) return;
        form.reset({
            file_complait: initialData.file_complait ?? false,
            no_signal: initialData.no_signal ?? false,
            bank_notification: initialData.bank_notification ?? false,
            access_website: initialData.access_website ?? false,
            access_link: initialData.access_link ?? false,
            used_to_operate_stolen_amount: initialData.used_to_operate_stolen_amount ?? false,
            lost_card: initialData.lost_card ?? false,
            fraud_incident_summary: initialData.fraud_incident_summary ?? '',
        });
    }, [initialData, form]);

    function onSubmit(values: z.infer<typeof formSchema>) {
        const formData = new FormData();
        formData.append('file_complait', String(values.file_complait));
        formData.append('no_signal', String(values.no_signal));
        formData.append('bank_notification', String(values.bank_notification));
        formData.append('access_website', String(values.access_website));
        formData.append('access_link', String(values.access_link));
        formData.append('used_to_operate_stolen_amount', String(values.used_to_operate_stolen_amount));
        formData.append('lost_card', String(values.lost_card));
        formData.append('fraud_incident_summary', values.fraud_incident_summary);

        startTransition(async () => {
            try {
                await updateInfoAboutEventsAction(id, formData);
                router.refresh();
                // Optionally route to the next step, for now just stay or show success 
                router.push(`/legal-process/client-side/${id}/success`); // Placeholder next step
            } catch (error) {
                console.error('Error saving incident summary:', error);
            }
        });
    }

    return (
        <div className="w-full max-w-screen-sm space-y-4">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-2 gap-6 mt-5">
                        <FormSwitch
                            control={form.control}
                            name="file_complait"
                            label="¿Presentó denuncia?"
                            showLabel
                        />
                        <FormSwitch
                            control={form.control}
                            name="no_signal"
                            label="¿Se quedó sin señal días previos al fraude?"
                            showLabel
                        />
                        <FormSwitch
                            control={form.control}
                            name="bank_notification"
                            label="¿Recibió notificaciones del Banco?"
                            showLabel
                        />
                        <FormSwitch
                            control={form.control}
                            name="access_website"
                            label="¿Ingresó a alguna página web?"
                            showLabel
                        />
                        <FormSwitch
                            control={form.control}
                            name="access_link"
                            label="¿Ingresó a algún link por mensaje de texto o correo electrónico sospechoso?"
                            showLabel
                        />
                        <FormSwitch
                            control={form.control}
                            name="used_to_operate_stolen_amount"
                            label="¿Acostumbraba a hacer operaciones por el monto hurtado?"
                            showLabel
                        />
                        <FormSwitch
                            control={form.control}
                            name="lost_card"
                            label="¿Perdió su tarjeta?"
                            showLabel
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-6 mt-5">
                        <FormTextarea
                            control={form.control}
                            name="fraud_incident_summary"
                            label="Redactar breve relato de los hechos sucedidos"
                            required
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
                                onClick={() => router.push(`/legal-process/client-side/${id}/back-information`)}
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
