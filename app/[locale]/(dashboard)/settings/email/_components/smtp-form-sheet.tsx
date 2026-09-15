'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, XCircle, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Form } from '@/components/ui/form';
import { FormInput } from '@/components/common/form/form-input';
import { FormSelect } from '@/components/common/form/form-select';
import Sheet from '@/components/common/sheet';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { testSmtpConnection, saveSmtpConnection } from '../actions';
import type { EmailConnectionInfo, SmtpConnectionInput } from '@/lib/email/types';

const smtpFormSchema = z.object({
  displayName: z.string().trim().min(1, 'Ingresa el nombre del remitente.').max(120),
  fromEmail: z.string().trim().email('Ingresa un email válido.'),
  host: z.string().trim().min(1, 'Ingresa el servidor SMTP.').max(255),
  port: z.coerce.number({ invalid_type_error: 'Ingresa un puerto válido.' }).int().min(1).max(65535),
  security: z.enum(['ssl_tls', 'starttls', 'none']),
  username: z.string().trim().min(1, 'Ingresa el usuario.').max(255),
  password: z.string().min(1, 'Ingresa la contraseña.').max(500),
  imapHost: z.string().trim().max(255).optional().or(z.literal('')),
  imapPort: z.coerce.number({ invalid_type_error: 'Ingresa un puerto válido.' }).int().min(1).max(65535).optional(),
  imapSecurity: z.enum(['ssl_tls', 'starttls', 'none']).optional(),
});

type SmtpFormValues = z.infer<typeof smtpFormSchema>;

const SECURITY_OPTIONS = [
  { label: 'SSL/TLS', value: 'ssl_tls' },
  { label: 'STARTTLS', value: 'starttls' },
  { label: 'Sin cifrado', value: 'none' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConnection: EmailConnectionInfo;
  /** True when a different provider is currently connected — save must confirm replacing it first. */
  requiresReplaceConfirm: boolean;
  onReplaceRequested: (proceed: () => void) => void;
  onSaved: (connection: EmailConnectionInfo) => void;
}

type TestState = 'idle' | 'testing' | 'success' | 'error';

export function SmtpFormSheet({
  open,
  onOpenChange,
  initialConnection,
  requiresReplaceConfirm,
  onReplaceRequested,
  onSaved,
}: Props) {
  const [testState, setTestState] = useState<TestState>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isSmtpAlready = initialConnection.provider === 'smtp' && initialConnection.status === 'connected';

  const form = useForm<SmtpFormValues>({
    resolver: zodResolver(smtpFormSchema),
    defaultValues: {
      displayName: isSmtpAlready ? initialConnection.displayName ?? '' : '',
      fromEmail: isSmtpAlready ? initialConnection.email : '',
      host: isSmtpAlready ? initialConnection.smtp?.host ?? '' : '',
      port: isSmtpAlready ? initialConnection.smtp?.port ?? 587 : 587,
      security: isSmtpAlready ? initialConnection.smtp?.security ?? 'starttls' : 'starttls',
      username: isSmtpAlready ? initialConnection.smtp?.username ?? '' : '',
      password: '',
      imapHost: isSmtpAlready ? initialConnection.smtp?.imap?.host ?? '' : '',
      imapPort: isSmtpAlready ? initialConnection.smtp?.imap?.port : undefined,
      imapSecurity: isSmtpAlready ? initialConnection.smtp?.imap?.security ?? 'ssl_tls' : 'ssl_tls',
    },
  });

  function resetTestState() {
    setTestState('idle');
    setTestMessage(null);
  }

  async function handleTest() {
    const valid = await form.trigger();
    if (!valid) return;

    setIsTesting(true);
    setTestState('testing');
    setTestMessage(null);
    try {
      const result = await testSmtpConnection(form.getValues() as SmtpConnectionInput);
      setTestState(result.success ? 'success' : 'error');
      setTestMessage(result.message);
    } catch {
      setTestState('error');
      setTestMessage('No pudimos conectar con el servidor SMTP. Verifica el servidor, puerto, usuario y contraseña.');
    } finally {
      setIsTesting(false);
    }
  }

  function doSave(values: SmtpFormValues) {
    setIsSaving(true);
    saveSmtpConnection(values as SmtpConnectionInput)
      .then((result) => {
        if (!result.success || !result.connection) {
          toast.error(result.message);
          setTestState('error');
          setTestMessage(result.message);
          return;
        }
        toast.success(result.message);
        onSaved(result.connection);
        onOpenChange(false);
        form.reset();
        resetTestState();
      })
      .catch(() => toast.error('No pudimos guardar la configuración. Intenta nuevamente.'))
      .finally(() => setIsSaving(false));
  }

  function handleSubmit(values: SmtpFormValues) {
    if (requiresReplaceConfirm) {
      onReplaceRequested(() => doSave(values));
      return;
    }
    doSave(values);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          form.reset();
          resetTestState();
        }
      }}
      title="Configurar SMTP"
      description="Configura cualquier servidor SMTP compatible: Gmail SMTP, Outlook, Zoho, Hostinger, cPanel u otro."
      size="lg"
      body={
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="w-full space-y-4 p-4 pt-0">
            <FormInput
              control={form.control}
              name="displayName"
              label="Nombre del remitente"
              placeholder="Estudio Jurídico Pérez"
              description="Nombre que verán tus clientes"
              disabled={isSaving}
              required
            />
            <FormInput
              control={form.control}
              name="fromEmail"
              label="Email del remitente"
              placeholder="abogado@estudiojuridico.com"
              type="email"
              disabled={isSaving}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <FormInput
                control={form.control}
                name="host"
                label="Servidor SMTP"
                placeholder="smtp.hostinger.com"
                disabled={isSaving}
                required
              />
              <FormInput
                control={form.control}
                name="port"
                label="Puerto"
                placeholder="465"
                type="number"
                disabled={isSaving}
                required
              />
            </div>

            <FormSelect
              control={form.control}
              name="security"
              label="Seguridad"
              options={SECURITY_OPTIONS}
              disabled={isSaving}
              required
            />
            {form.watch('security') === 'none' && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  No recomendado: tu usuario y contraseña viajarán sin cifrar. Usa SSL/TLS o STARTTLS si tu proveedor lo permite.
                </span>
              </div>
            )}

            <FormInput
              control={form.control}
              name="username"
              label="Usuario"
              placeholder="abogado@estudiojuridico.com"
              disabled={isSaving}
              required
            />
            <FormInput
              control={form.control}
              name="password"
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              disabled={isSaving}
              required
            />

            <div className="space-y-3 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Lectura de respuestas (opcional)</p>
                <p className="text-xs text-muted-foreground">
                  Completa esto para que el nodo &quot;Esperar Respuesta de Correo&quot; lea directamente tu bandeja real
                  (misma cuenta, credenciales de arriba) en vez de un mecanismo alterno. Si lo dejas vacío, ese nodo
                  sigue funcionando igual, solo que las respuestas no llegan a tu bandeja.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormInput
                  control={form.control}
                  name="imapHost"
                  label="Servidor IMAP"
                  placeholder="imap.hostinger.com"
                  disabled={isSaving}
                />
                <FormInput
                  control={form.control}
                  name="imapPort"
                  label="Puerto"
                  placeholder="993"
                  type="number"
                  disabled={isSaving}
                />
              </div>
              <FormSelect
                control={form.control}
                name="imapSecurity"
                label="Seguridad"
                options={SECURITY_OPTIONS}
                disabled={isSaving}
              />
            </div>

            {testMessage && (
              <div
                className={cn(
                  'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
                  testState === 'success' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                  testState === 'error' && 'border-destructive/30 bg-destructive/10 text-destructive',
                )}
              >
                {testState === 'success' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>{testState === 'success' ? `✓ ${testMessage}` : testMessage}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleTest}
                disabled={isTesting || isSaving}
              >
                {isTesting ? <Spinner className="h-4 w-4" /> : 'Probar conexión'}
              </Button>
              <Button type="submit" className="flex-1" disabled={isSaving || isTesting}>
                {isSaving ? <Spinner className="h-4 w-4" /> : 'Guardar configuración'}
              </Button>
            </div>
          </form>
        </Form>
      }
    />
  );
}
