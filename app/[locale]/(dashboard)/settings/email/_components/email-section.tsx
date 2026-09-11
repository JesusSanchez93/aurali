'use client';

import { useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
import { Mail, CheckCircle2, ExternalLink, Loader2, Server, Send } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { disconnectEmailConnection } from '../actions';
import { SmtpFormSheet } from './smtp-form-sheet';
import { SmtpTestEmailDialog } from './smtp-test-email-dialog';
import type { EmailConnectionInfo, EmailProvider } from '@/lib/email/types';

const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google Workspace',
  microsoft: 'Microsoft 365',
  smtp: 'SMTP',
  aurali: 'Aurali',
};

const SECURITY_LABEL: Record<string, string> = {
  ssl_tls: 'SSL/TLS',
  starttls: 'STARTTLS',
  none: 'Sin cifrado',
};

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Cancelaste la conexión con el proveedor.',
  not_configured: 'Este proveedor aún no está habilitado en el servidor.',
  no_organization: 'No se encontró una organización activa en tu sesión.',
  invalid_state: 'La solicitud de conexión expiró o no es válida. Intenta nuevamente.',
  missing_state: 'La solicitud de conexión expiró. Intenta nuevamente.',
  token_exchange_failed: 'No pudimos completar la conexión con el proveedor.',
  no_email_scope: 'No pudimos obtener el correo de la cuenta conectada.',
  save_failed: 'No pudimos guardar la conexión. Intenta nuevamente.',
  unsupported_provider: 'Proveedor no soportado.',
  unexpected: 'Ocurrió un error inesperado al conectar tu correo.',
};

const DEFAULT_AURALI: EmailConnectionInfo = {
  provider: 'aurali',
  email: 'notificaciones@aurali.app',
  displayName: null,
  status: 'disconnected',
  errorMessage: null,
  connectedAt: null,
  smtp: null,
};

interface Props {
  initialConnection: EmailConnectionInfo;
  locale: string;
}

export function EmailSection({ initialConnection, locale }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connection, setConnection] = useState(initialConnection);
  const [smtpSheetOpen, setSmtpSheetOpen] = useState(false);
  const [smtpTestDialogOpen, setSmtpTestDialogOpen] = useState(false);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [isDisconnecting, startDisconnect] = useTransition();

  // Replace-confirmation: set when the user tries to activate a different
  // provider while one is already connected.
  const [replaceConfirm, setReplaceConfirm] = useState<{ targetLabel: string; proceed: () => void } | null>(null);

  useEffect(() => {
    const connected = searchParams.get('email_connected');
    const errorCode = searchParams.get('email_error');

    if (connected) {
      toast.success('Correo conectado correctamente');
      router.replace('/settings/email');
      router.refresh();
    } else if (errorCode) {
      toast.error(ERROR_MESSAGES[errorCode] ?? 'No pudimos conectar tu correo.');
      router.replace('/settings/email');
    }
  }, [searchParams, router]);

  const isConnected = connection.status === 'connected';
  const isError = connection.status === 'error';
  const hasOtherActiveConnection = (target: EmailProvider) =>
    connection.status === 'connected' && connection.provider !== target;

  function goToOAuthConnect(provider: 'google' | 'microsoft') {
    setConnectingProvider(provider);
    window.location.href = `/api/auth/email/${provider}/connect?locale=${locale}`;
  }

  function handleConnectOAuth(provider: 'google' | 'microsoft') {
    if (hasOtherActiveConnection(provider)) {
      setReplaceConfirm({
        targetLabel: PROVIDER_LABEL[provider],
        proceed: () => goToOAuthConnect(provider),
      });
      return;
    }
    goToOAuthConnect(provider);
  }

  function handleDisconnect() {
    startDisconnect(async () => {
      try {
        await disconnectEmailConnection();
        setConnection(DEFAULT_AURALI);
        router.refresh();
        toast.success('Correo desconectado. Aurali usará su correo interno.');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al desconectar el correo');
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Correo electrónico</h1>
        <p className="max-w-[560px] text-sm text-muted-foreground">
          Configura el correo que Aurali utilizará para enviar y recibir comunicaciones relacionadas con tus procesos y documentos.
        </p>
      </div>

      {/* ── Current status card ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <span className="text-sm font-medium text-muted-foreground">Correo utilizado actualmente</span>
        </CardHeader>
        <CardContent className="space-y-4">
          {isError ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                  <Mail className="h-4.5 w-4.5 text-destructive" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-destructive">No pudimos conectar tu correo</p>
                  <p className="text-sm text-muted-foreground">
                    {connection.errorMessage || 'La conexión no pudo completarse. Intenta nuevamente.'}
                  </p>
                </div>
              </div>
            </div>
          ) : connection.provider === 'smtp' && isConnected ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                    <Server className="h-4.5 w-4.5 text-emerald-600" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">SMTP conectado</span>
                      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600/90">
                        <CheckCircle2 className="h-3 w-3" />
                        Conectado
                      </Badge>
                    </div>
                    {connection.displayName && <p className="text-sm">{connection.displayName}</p>}
                    <p className="font-mono text-sm text-muted-foreground">{connection.email}</p>
                    {connection.smtp && (
                      <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 pt-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <span>Servidor: <span className="font-mono">{connection.smtp.host}</span></span>
                        <span>Puerto: <span className="font-mono">{connection.smtp.port}</span></span>
                        <span>Seguridad: {SECURITY_LABEL[connection.smtp.security]}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setSmtpTestDialogOpen(true)}>
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Enviar correo de prueba
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSmtpSheetOpen(true)}>
                  Editar configuración
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmDisconnectOpen(true)}
                >
                  Desconectar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    isConnected ? 'bg-emerald-500/10' : 'bg-primary/10',
                  )}
                >
                  <Mail className={cn('h-4.5 w-4.5', isConnected ? 'text-emerald-600' : 'text-primary')} />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {isConnected ? 'Correo de tu organización' : 'Correo de Aurali'}
                    </span>
                    <Badge
                      variant={isConnected ? 'default' : 'secondary'}
                      className={isConnected ? 'gap-1 bg-emerald-600 hover:bg-emerald-600/90' : 'gap-1'}
                    >
                      {isConnected && <CheckCircle2 className="h-3 w-3" />}
                      {isConnected ? 'Conectado' : 'Predeterminado'}
                    </Badge>
                    {isConnected && (
                      <span className="text-xs text-muted-foreground">{PROVIDER_LABEL[connection.provider]}</span>
                    )}
                  </div>
                  <p className="font-mono text-sm text-muted-foreground">{connection.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {isConnected
                      ? 'Las comunicaciones de tus procesos utilizarán este correo.'
                      : 'Actualmente Aurali utiliza su correo interno para enviar las comunicaciones de tu organización.'}
                  </p>
                </div>
              </div>

              {isConnected && (
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setConfirmDisconnectOpen(true)}
                  >
                    Desconectar
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Provider options ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Conecta tu correo</h2>
          <p className="text-sm text-muted-foreground">
            Elige cómo quieres que Aurali gestione las comunicaciones con tus clientes.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className={cn(connection.provider === 'google' && isConnected && 'border-emerald-500/40')}>
            <CardContent className="flex h-full flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                <GoogleIcon className="h-5 w-5" />
                <span className="font-medium">Google</span>
              </div>
              <p className="flex-1 text-xs text-muted-foreground">
                Conecta tu cuenta de Google o Gmail personal o de Google Workspace.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={connectingProvider !== null}
                onClick={() => handleConnectOAuth('google')}
              >
                {connectingProvider === 'google' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Conectar Google
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className={cn(connection.provider === 'microsoft' && isConnected && 'border-emerald-500/40')}>
            <CardContent className="flex h-full flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                <MicrosoftIcon className="h-5 w-5" />
                <span className="font-medium">Microsoft</span>
              </div>
              <p className="flex-1 text-xs text-muted-foreground">
                Conecta Microsoft 365 / Outlook.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={connectingProvider !== null}
                onClick={() => handleConnectOAuth('microsoft')}
              >
                {connectingProvider === 'microsoft' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Conectar Microsoft
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className={cn(connection.provider === 'smtp' && isConnected && 'border-emerald-500/40')}>
            <CardContent className="flex h-full flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">SMTP</span>
              </div>
              <p className="flex-1 text-xs text-muted-foreground">
                Configura cualquier servidor SMTP: Gmail, Outlook, Zoho, Hostinger, cPanel u otro.
              </p>
              <Button variant="outline" size="sm" onClick={() => setSmtpSheetOpen(true)}>
                Configurar SMTP
              </Button>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <p className="text-xs text-muted-foreground">
          Al conectar tu cuenta, Aurali podrá utilizarla para enviar y procesar las respuestas relacionadas con tus procesos.
        </p>
      </div>

      {/* ── SMTP configuration sheet ───────────────────────────────────── */}
      <SmtpFormSheet
        open={smtpSheetOpen}
        onOpenChange={setSmtpSheetOpen}
        initialConnection={connection}
        requiresReplaceConfirm={hasOtherActiveConnection('smtp')}
        onReplaceRequested={(proceed) => setReplaceConfirm({ targetLabel: 'SMTP', proceed })}
        onSaved={setConnection}
      />

      {/* ── Send test email ────────────────────────────────────────────── */}
      <SmtpTestEmailDialog open={smtpTestDialogOpen} onOpenChange={setSmtpTestDialogOpen} />

      {/* ── Replace-active-provider confirmation ───────────────────────── */}
      <ConfirmDialog
        isOpen={replaceConfirm !== null}
        onClose={() => setReplaceConfirm(null)}
        onConfirm={() => replaceConfirm?.proceed()}
        title="Ya tienes otro correo conectado"
        description={`¿Quieres reemplazarlo por ${replaceConfirm?.targetLabel ?? 'esta configuración'}?`}
        confirmLabel="Reemplazar"
        variant="destructive"
      />

      {/* ── Disconnect confirmation ────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={confirmDisconnectOpen}
        onClose={() => setConfirmDisconnectOpen(false)}
        onConfirm={handleDisconnect}
        title="¿Desconectar este correo?"
        description="Después de desconectar este correo, Aurali utilizará automáticamente su sistema interno de correo para enviar las comunicaciones."
        confirmLabel={isDisconnecting ? 'Desconectando…' : 'Desconectar'}
        variant="destructive"
      />
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.59 6.59 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}
