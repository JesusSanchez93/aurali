import { Clock } from 'lucide-react';

export default function LinkExpiredPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-white dark:bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Clock className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-semibold">Enlace expirado</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Este enlace ya fue utilizado o ha expirado. Si necesitas acceder al formulario,
            comunícate con el abogado que gestionó tu caso.
          </p>
        </div>
      </div>
    </div>
  );
}
