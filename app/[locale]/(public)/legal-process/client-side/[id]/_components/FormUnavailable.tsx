import { CheckCircle2, Lock, AlertCircle } from 'lucide-react';

type Reason = 'completed' | 'no_access' | 'unavailable';

const config: Record<Reason, { icon: React.ElementType; title: string; description: string }> = {
  completed: {
    icon: CheckCircle2,
    title: '¡Formulario enviado!',
    description:
      'Ya completaste el registro de tu caso. Nuestro equipo revisará la información y se pondrá en contacto contigo pronto. No es necesario que vuelvas a enviar el formulario.',
  },
  no_access: {
    icon: Lock,
    title: 'Acceso no válido',
    description:
      'Este enlace no es válido para tu sesión actual. Si recibiste un correo con un enlace, úsalo directamente desde ese correo para acceder al formulario.',
  },
  unavailable: {
    icon: AlertCircle,
    title: 'Formulario no disponible',
    description:
      'Este formulario ya no está disponible. Si tienes dudas, comunícate con el abogado que gestionó tu caso.',
  },
};

export function FormUnavailable({ reason }: { reason: Reason }) {
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
