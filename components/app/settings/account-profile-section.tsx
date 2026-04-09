'use client';

import { z } from 'zod';
import { useTransition, useMemo, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/common/form/form-input';
import { FormSelect } from '@/components/common/form/form-select';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, User, Building2, PenLine, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { updateAccountProfile, uploadProfileSignature, deleteProfileSignature } from '@/app/[locale]/(dashboard)/account/actions';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SignatureInput } from '@/components/common/signature-input';

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
    professional_card_number: string | null;
    signature_url: string | null;
  };
  documentTypeOptions: { value: string; label: string }[];
  memberships: Membership[];
};

export default function AccountProfileSection({ profile, documentTypeOptions, memberships }: Props) {
  const processT = useTranslations('process.fields');
  const validationT = useTranslations('common.validation');
  const t = useTranslations('settings.account');
  const [isPending, startTransition] = useTransition();

  // ── Signature state ───────────────────────────────────────────────────────
  const [signatureUrl, setSignatureUrl] = useState<string | null>(profile.signature_url);
  const [signaturePending, startSignatureTransition] = useTransition();
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);

  function handleSignatureConfirm(base64: string) {
    setSignatureDialogOpen(false);
    startSignatureTransition(async () => {
      try {
        const url = await uploadProfileSignature(base64);
        setSignatureUrl(url);
        toast.success(t('signature_saved'));
      } catch {
        toast.error(t('signature_save_error'));
      }
    });
  }

  function handleDeleteSignature() {
    startSignatureTransition(async () => {
      try {
        await deleteProfileSignature();
        setSignatureUrl(null);
        toast.success(t('signature_deleted'));
      } catch {
        toast.error(t('signature_delete_error'));
      }
    });
  }

  // ── Profile form ─────────────────────────────────────────────────────────
  const schema = useMemo(() => z.object({
    firstname: z.string().trim().min(1, validationT('required')),
    lastname: z.string().trim().min(1, validationT('required')),
    phone: z.string().trim().min(1, validationT('required')),
    document_type: z.string().trim().min(1, validationT('required')),
    document_number: z.string().trim().min(1, validationT('required')),
    professional_card_number: z.string().trim().optional(),
  }), [validationT]);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstname: profile.firstname,
      lastname: profile.lastname,
      phone: profile.phone,
      document_type: profile.document_type,
      document_number: profile.document_number,
      professional_card_number: profile.professional_card_number ?? '',
    },
  });

  function onSubmit(values: z.infer<typeof schema>) {
    startTransition(async () => {
      try {
        await updateAccountProfile({
          ...values,
          professional_card_number: values.professional_card_number || undefined,
        });
        toast.success(t('profile_updated'));
      } catch {
        toast.error(t('profile_update_error'));
      }
    });
  }

  return (
    <div className="space-y-8">

      {/* ── Personal data ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{t('personal_data')}</h2>
          <p className="text-sm text-muted-foreground">{t('personal_data_description')}</p>
        </div>
        <div className="rounded-xl border border-[#a9b4b9]/20 bg-white p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] flex flex-col sm:flex-row gap-8">
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
              <FormInput
                control={form.control}
                name="professional_card_number"
                label={processT('professional_card_number')}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
                {t('save_changes')}
              </Button>
            </div>
          </form>
        </Form>
        </div>
      </section>
      

      {/* ── Signature ─────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{t('signature_title')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('signature_description')}
          </p>
        </div>

        {signatureUrl ? (
          /* ── Has signature: card with preview + metadata ── */
          <div className="rounded-xl border border-[#a9b4b9]/20 bg-white p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] flex flex-col sm:flex-row gap-8">
            {/* Signature canvas area */}
            <div className="flex-shrink-0 w-full sm:w-auto">
              <div className="relative flex w-full sm:w-72 items-center justify-center rounded-lg border border-dashed p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signatureUrl}
                  alt="Firma"
                  className="relative z-10 block max-h-full max-w-full object-contain"
                />
                <span className="pointer-events-none absolute left-[8%] right-[8%] top-[70%] border-t border-dashed border-slate-300" />
              </div>
            </div>

            {/* Metadata + actions */}
            <div className="flex flex-1 flex-col gap-4 w-full">
              {/* Status badge */}
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-green-100 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {t('signature_registered')}
              </span>

              {/* Meta info */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {t('signature_status_label')}
                </p>
                <p className="text-sm text-foreground">{t('signature_status_active')}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={signaturePending}
                  onClick={() => setSignatureDialogOpen(true)}
                >
                  <PenLine className="mr-1.5 h-3.5 w-3.5" />
                  {t('signature_change')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={signaturePending}
                  onClick={handleDeleteSignature}
                >
                  {signaturePending
                    ? <Spinner className="mr-1.5 h-3.5 w-3.5" />
                    : <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  }
                  {t('signature_delete')}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* ── No signature: empty state ── */
          <button
            type="button"
            disabled={signaturePending}
            onClick={() => setSignatureDialogOpen(true)}
            className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/25 text-muted-foreground transition hover:border-muted-foreground/50 hover:bg-muted/30 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            {signaturePending ? (
              <Spinner className="h-6 w-6" />
            ) : (
              <>
                <PenLine className="h-6 w-6 opacity-40" />
                <span className="text-sm font-medium">{t('signature_create')}</span>
                <span className="text-xs opacity-60">{t('signature_empty_hint')}</span>
              </>
            )}
          </button>
        )}

        {/* Signature dialog */}
        <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('signature_create')}</DialogTitle>
            </DialogHeader>
            <SignatureInput
              onConfirm={handleSignatureConfirm}
              onCancel={() => setSignatureDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </section>

      {/* ── Organizations ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{t('organizations_title')}</h2>
          <p className="text-sm text-muted-foreground">{t('organizations_description')}</p>
        </div>
        <div className="rounded-xl border border-[#a9b4b9]/20 bg-white p-6 shadow-[0px_12px_32px_rgba(42,52,57,0.06)] flex flex-col gap-8">
        {memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('organizations_empty')}</p>
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
                    {m.role === 'ORG_ADMIN' ? t('role_admin') : t('role_user')}
                  </Badge>
                  {!m.active && (
                    <Badge variant="outline" className="text-muted-foreground">{t('inactive')}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}</div>
      </section>

    </div>
  );
}
