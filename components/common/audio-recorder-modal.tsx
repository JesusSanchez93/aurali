'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, Pause, Play, Square, AlertCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type RecorderState = 'idle' | 'recording' | 'paused' | 'processing' | 'error';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (text: string) => void;
}

export function AudioRecorderModal({ open, onOpenChange, onComplete }: Props) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }, [stopTimer]);

  const cleanup = useCallback(() => {
    stopTimer();
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
  }, [stopTimer]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      cleanup();
      setState('idle');
      setElapsed(0);
      setErrorMsg('');
    }
  }, [open, cleanup]);

  async function startRecording() {
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(250);
      setState('recording');
      startTimer();
    } catch {
      setErrorMsg('No se pudo acceder al micrófono. Verifica los permisos.');
      setState('error');
    }
  }

  function pauseRecording() {
    mediaRecorderRef.current?.pause();
    stopTimer();
    setState('paused');
  }

  function resumeRecording() {
    mediaRecorderRef.current?.resume();
    startTimer();
    setState('recording');
  }

  async function finishRecording() {
    stopTimer();
    setState('processing');

    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    recorder.onstop = async () => {
      const mimeType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });

      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      chunksRef.current = [];

      try {
        const fd = new FormData();
        fd.append('audio', blob);

        const res = await fetch('/api/legal-process/transcribe-audio', {
          method: 'POST',
          body: fd,
        });

        const data = await res.json();
        if (!res.ok || !data.text) throw new Error(data.error ?? 'Error desconocido');

        onComplete(data.text);
        onOpenChange(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error procesando el audio';
        setErrorMsg(msg);
        setState('error');
      }
    };

    recorder.stop();
  }

  function reset() {
    cleanup();
    setState('idle');
    setElapsed(0);
    setErrorMsg('');
  }

  const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const seconds = String(elapsed % 60).padStart(2, '0');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Grabar relato de los hechos</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          {/* Indicator */}
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            {state === 'recording' && (
              <span className="absolute inset-0 animate-ping rounded-full bg-red-400/40" />
            )}
            <Mic
              className={cn(
                'h-8 w-8 transition-colors',
                state === 'recording' && 'text-red-500',
                state === 'paused' && 'text-yellow-500',
                state === 'processing' && 'text-muted-foreground',
                state === 'idle' && 'text-muted-foreground',
                state === 'error' && 'text-destructive',
              )}
            />
          </div>

          {/* Timer */}
          {(state === 'recording' || state === 'paused') && (
            <span className="font-mono text-2xl font-semibold tabular-nums">
              {minutes}:{seconds}
            </span>
          )}

          {/* Processing */}
          {state === 'processing' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4" />
              Procesando con IA…
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-3">
            {state === 'idle' && (
              <Button onClick={startRecording} className="gap-2">
                <Mic className="h-4 w-4" />
                Iniciar grabación
              </Button>
            )}

            {state === 'recording' && (
              <>
                <Button variant="outline" onClick={pauseRecording} className="gap-2">
                  <Pause className="h-4 w-4" />
                  Pausar
                </Button>
                <Button variant="destructive" onClick={finishRecording} className="gap-2">
                  <Square className="h-4 w-4" />
                  Finalizar
                </Button>
              </>
            )}

            {state === 'paused' && (
              <>
                <Button variant="outline" onClick={resumeRecording} className="gap-2">
                  <Play className="h-4 w-4" />
                  Reanudar
                </Button>
                <Button variant="destructive" onClick={finishRecording} className="gap-2">
                  <Square className="h-4 w-4" />
                  Finalizar
                </Button>
              </>
            )}

            {state === 'error' && (
              <Button variant="outline" onClick={reset}>
                Reintentar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
