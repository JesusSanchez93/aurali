'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ExternalLink, LogOut, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  connected: boolean;
  email: string | null;
  locale: string;
  disabled?: boolean;
}

export function GoogleConnection({ connected, email, locale, disabled = false }: Props) {
  const [isConnected, setIsConnected] = useState(connected);
  const [connectedEmail, setConnectedEmail] = useState(email);
  const [isPending, startTransition] = useTransition();

  function handleConnect() {
    window.location.href = '/api/google/auth';
  }

  function handleDisconnect() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/google/disconnect', { method: 'DELETE' });
        if (!res.ok) {
          const json = await res.json() as { error?: string };
          throw new Error(json.error ?? 'Error al desconectar');
        }
        setIsConnected(false);
        setConnectedEmail(null);
        toast.success('Cuenta de Google desconectada');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al desconectar');
      }
    });
  }

  void locale; // usado por el padre para construir el redirect

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-center gap-3">
        {/* Google Icon */}
        <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-white">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        </div>

        <div>
          <p className="text-sm font-medium">Google Docs</p>
          {isConnected && connectedEmail ? (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs text-muted-foreground">{connectedEmail}</span>
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">Conectado</Badge>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No conectado</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <Button size="sm" variant="secondary" onClick={handleConnect} disabled={isPending}>
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
              Reconectar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={isPending}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Desconectar
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={handleConnect} disabled={disabled}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Conectar Google
          </Button>
        )}
      </div>
    </div>
  );
}
