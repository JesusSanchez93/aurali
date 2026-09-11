import { CheckCircle2, Lock, AlertCircle } from 'lucide-react';

type Reason = 'no_access' | 'already_reviewed' | 'not_found';

const config: Record<Reason, { icon: React.ElementType; title: string; description: string }> = {
  no_access: {
    icon: Lock,
    title: 'Acceso no válido',
    description:
      'Este enlace no es válido para tu sesión actual. Si recibiste un correo con un enlace, úsalo directamente desde ese correo.',
  },
  already_reviewed: {
    icon: CheckCircle2,
    title: 'Documentos ya revisados',
    description:
      'Los documentos de esta solicitud ya fueron revisados. Si tienes dudas, comunícate con el abogado que gestiona tu caso.',
  },
  not_found: {
    icon: AlertCircle,
    title: 'Solicitud no encontrada',
    description: 'No encontramos esta solicitud de firma. Verifica el enlace del correo.',
  },
};

export function SignatureUnavailable({ reason }: { reason: Reason }) {
  const { icon: Icon, title, description } = config[reason];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-white dark:bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
