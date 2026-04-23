'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Terminal, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Props {
  credentialsConfigured: boolean;
  isSuperAdmin: boolean;
  connected?: boolean;
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
        {number}
      </div>
      <div className="space-y-1 pt-0.5">
        <p className="text-sm font-medium">{title}</p>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <code className="block rounded border bg-muted px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre">
      {children}
    </code>
  );
}

export function GoogleSetupGuide({ credentialsConfigured, isSuperAdmin, connected }: Props) {
  const [adminOpen, setAdminOpen] = useState(!credentialsConfigured);

  // Si ya está conectado y no es superadmin, no hay nada que mostrar
  if (connected && !isSuperAdmin) return null;

  return (
    <div className="space-y-0 rounded-lg border divide-y">

      {/* ── Sección del abogado (solo cuando no está conectado) ── */}
      {!connected && <div className="px-4 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-4 w-4 items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          </div>
          <span className="text-sm font-medium">Cómo conectar tu cuenta de Google</span>
        </div>

        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">No necesitas crear ningún proyecto en Google Cloud.</strong>{' '}
          Simplemente conecta tu cuenta personal de Google con el botón de abajo. Cada abogado conecta su propia cuenta de forma independiente.
        </p>

        <ol className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="font-semibold text-foreground shrink-0">1.</span>
            Haz clic en <strong>Conectar Google</strong> y selecciona tu cuenta de Google.
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-foreground shrink-0">2.</span>
            Acepta el permiso de acceso de solo lectura a Google Drive.
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-foreground shrink-0">3.</span>
            Serás redirigido aquí con tu cuenta conectada. Ya puedes crear plantillas.
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-foreground shrink-0">4.</span>
            En el Google Doc, escribe las variables con el formato{' '}
            <code className="rounded bg-muted px-1 text-xs">{'{GRUPO.VARIABLE}'}</code>{' '}
            — por ejemplo: <code className="rounded bg-muted px-1 text-xs">{'{CLIENT.FIRST_NAME}'}</code>,{' '}
            <code className="rounded bg-muted px-1 text-xs">{'{PROCESS.ID}'}</code>.
          </li>
        </ol>

        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <strong>Importante:</strong> el Google Doc debe estar compartido con la cuenta que conectes
          (al menos con permiso de <em>Lector</em>).{' '}
          <Button variant="link" size="sm" className="h-auto p-0 text-xs text-amber-800 underline" asChild>
            <a href="https://support.google.com/docs/answer/2494822" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
              Cómo compartir un Doc <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </div>}

      {/* ── Sección administrador del servidor (solo superadmin) ── */}
      {isSuperAdmin && <div>
        <button
          type="button"
          onClick={() => setAdminOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Configuración del servidor (administrador de Aurali)</span>
            {credentialsConfigured ? (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Configurado
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-[10px]">Requerido</Badge>
            )}
          </div>
          {adminOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {adminOpen && (
          <div className="space-y-5 border-t px-4 pb-5 pt-4">
            <p className="text-sm text-muted-foreground">
              Esta configuración la realiza <strong>una sola vez</strong> quien administra el despliegue de Aurali.
              Una vez configurada, todos los abogados de la plataforma podrán conectar su propia cuenta de Google sin ningún paso adicional.
            </p>

            <div className="space-y-4">
              <Step number={1} title="Crea un proyecto en Google Cloud Console">
                Ve a{' '}
                <a
                  href="https://console.cloud.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                >
                  console.cloud.google.com
                  <ExternalLink className="h-3 w-3" />
                </a>{' '}
                y crea un nuevo proyecto (ej: <em>Aurali</em>).
              </Step>

              <Step number={2} title="Habilita la Google Drive API">
                <strong>APIs y servicios → Biblioteca</strong> → busca <strong>Google Drive API</strong> → <strong>Habilitar</strong>.
              </Step>

              <Step number={3} title="Configura la pantalla de consentimiento OAuth">
                <strong>APIs y servicios → Pantalla de consentimiento OAuth</strong>:
                <ul className="mt-1.5 list-inside list-disc space-y-0.5">
                  <li>Tipo de usuario: <strong>Externo</strong></li>
                  <li>Rellena nombre de la app, email de soporte y contacto del desarrollador</li>
                  <li>Scope: <code className="rounded bg-muted px-1 text-xs">.../auth/drive.readonly</code></li>
                  <li>En pruebas: añade los emails de los abogados como usuarios de prueba</li>
                </ul>
              </Step>

              <Step number={4} title="Crea las credenciales OAuth 2.0">
                <strong>Credenciales → Crear credenciales → ID de cliente OAuth 2.0</strong>:
                <ul className="mt-1.5 list-inside list-disc space-y-0.5">
                  <li>Tipo: <strong>Aplicación web</strong></li>
                  <li>URI de redireccionamiento autorizado:</li>
                </ul>
                <div className="mt-2">
                  <CodeBlock>{`https://tu-dominio.com/api/google/callback\n\n# En desarrollo local:\nhttp://localhost:3000/api/google/callback`}</CodeBlock>
                </div>
                Copia el <strong>Client ID</strong> y el <strong>Client Secret</strong>.
              </Step>

              <Step number={5} title="Añade las variables de entorno al servidor">
                En Vercel (production) o en <code className="rounded bg-muted px-1 text-xs">.env.local</code> (desarrollo):
                <div className="mt-2">
                  <CodeBlock>{`GOOGLE_CLIENT_ID=tu_client_id\nGOOGLE_CLIENT_SECRET=tu_client_secret\nGOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback`}</CodeBlock>
                </div>
                Reinicia el servidor tras añadirlas.
              </Step>
            </div>
          </div>
        )}
      </div>}
    </div>
  );
}
