'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function LegalProcessError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[legal-process/error-boundary]', {
      message: error.message,
      digest: error.digest ?? null,
      stack: error.stack ?? null,
    });
  }, [error]);

  return (
    <div className="mx-auto max-w-xl rounded-lg border bg-card p-6 text-card-foreground">
      <h2 className="text-lg font-semibold">Error al cargar procesos legales</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Ocurrió un error en producción. Usa el código de diagnóstico para buscar el detalle en logs.
      </p>
      <div className="mt-4 rounded-md bg-muted p-3 font-mono text-xs">
        digest: {error.digest ?? 'no-digest'}
      </div>
      <Button className="mt-4" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
