'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { verifyOtpAction, resendOtpAction } from '../actions';

export function VerifyOtpForm({
  requestId,
  clientEmail,
  otpPending,
}: {
  requestId: string;
  clientEmail: string;
  /** true cuando aún no se ha enviado ningún código — hay que disparar el primer envío al montar. */
  otpPending: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  // Solo corre en un navegador real con JS habilitado — a diferencia del GET
  // de validate-token, un escáner de enlaces de correo nunca llega a esto.
  const [sendingFirstCode, setSendingFirstCode] = useState(otpPending);

  useEffect(() => {
    if (!otpPending) return;
    resendOtpAction(requestId)
      .then((result) => {
        if (!result.success) setError(result.error);
      })
      .finally(() => setSendingFirstCode(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (code.length !== 6) return;
    setSubmitting(true);
    setError(null);
    const result = await verifyOtpAction(requestId, code);
    if (result.success) {
      router.push(`/legal-process/sign-documents/${requestId}`);
    } else {
      setError(result.error);
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    const result = await resendOtpAction(requestId);
    if (result.success) {
      setResent(true);
      setCode('');
    } else {
      setError(result.error);
    }
    setResending(false);
  };

  if (sendingFirstCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 p-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border bg-white dark:bg-card p-8 text-center shadow-sm">
          <Spinner className="h-6 w-6" />
          <p className="text-sm text-muted-foreground">Enviando código de verificación a {clientEmail}…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 p-6">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-white dark:bg-card p-8 text-center shadow-sm">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold">Verifica tu correo</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Enviamos un código de 6 dígitos a <span className="font-medium">{clientEmail}</span>. Ingrésalo para
            continuar con la firma de tus documentos.
          </p>
        </div>

        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS}
            value={code}
            onChange={setCode}
            disabled={submitting}
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} className="h-12 w-10 text-lg" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {resent && !error && <p className="text-sm text-emerald-600">Te enviamos un nuevo código.</p>}

        <Button className="w-full" disabled={code.length !== 6 || submitting} onClick={handleSubmit}>
          {submitting ? <Spinner className="h-4 w-4" /> : 'Verificar código'}
        </Button>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="text-sm text-muted-foreground underline underline-offset-2 disabled:opacity-50"
        >
          {resending ? 'Enviando…' : 'Reenviar código'}
        </button>
      </div>
    </div>
  );
}
