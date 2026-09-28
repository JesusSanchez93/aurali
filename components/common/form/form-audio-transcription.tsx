'use client';

import { useRef, useState } from 'react';
import { Control, FieldValues, Path, useFormContext } from 'react-hook-form';
import { Loader2, Mic, Sparkles } from 'lucide-react';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { FormControl, FormField, FormItem, FormMessage } from '../../ui/form';
import { AudioRecorderModal } from '../audio-recorder-modal';

interface Props<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  rows?: number;
}

/**
 * Textarea con botón "Grabar audio" que abre AudioRecorderModal y transcribe
 * la grabación al campo de texto. Reutiliza el modal ya compartido usado por
 * el flujo público de fraude bancario (InfoAboutEventsForm.tsx).
 *
 * El relato queda siempre con el mismo tono técnico/formal sin importar
 * cómo llegó: si se grabó, transcribe-audio ya lo redacta (vía
 * polishLegalNarrative); si el cliente escribió directamente, este
 * componente manda el texto a pulir (polish-narrative/route.ts, mismo
 * prompt) al salir del campo — nunca las dos veces sobre el mismo texto
 * (justRecordedRef evita re-pulir lo que ya llegó pulido de la grabación).
 */
export function FormAudioTranscription<T extends FieldValues>({
  control,
  name,
  label,
  required,
  disabled,
  className,
  rows = 6,
}: Props<T>) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const { setValue } = useFormContext<T>();

  // true justo después de una grabación — el próximo blur no debe volver a
  // pulir lo que transcribe-audio ya redactó.
  const justRecordedRef = useRef(false);
  // Último texto ya pulido — evita re-pulir en un blur sin ediciones nuevas
  // (p. ej. el usuario hace click adentro y afuera sin escribir nada).
  const lastPolishedRef = useRef('');

  const handleRecordingComplete = (text: string) => {
    justRecordedRef.current = true;
    lastPolishedRef.current = text;
    setValue(name, text as never, { shouldDirty: true, shouldValidate: true });
  };

  const handleBlur = async (currentText: string) => {
    if (justRecordedRef.current) {
      justRecordedRef.current = false;
      return;
    }
    const trimmed = currentText.trim();
    if (!trimmed || trimmed === lastPolishedRef.current) return;

    setIsPolishing(true);
    try {
      const res = await fetch('/api/legal-process/polish-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      if (res.ok) {
        const { text: polished } = await res.json();
        lastPolishedRef.current = polished;
        setValue(name, polished as never, { shouldDirty: true, shouldValidate: true });
      }
    } catch {
      // Best-effort: si falla, el texto tal cual como lo escribió el
      // cliente se queda — nunca bloquea el avance del formulario.
    } finally {
      setIsPolishing(false);
    }
  };

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between">
        {label && (
          <span className="text-sm font-medium">
            {label}
            {required && <span className="ml-0.5 text-red-500">*</span>}
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-full text-xs"
          disabled={disabled}
          onClick={() => setModalOpen(true)}
        >
          <Mic className="h-3.5 w-3.5" />
          Grabar audio
        </Button>
      </div>

      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <div className="relative">
                <Textarea
                  {...field}
                  rows={rows}
                  disabled={disabled || isPolishing}
                  className="resize-y bg-white dark:bg-black"
                  onBlur={(e) => {
                    field.onBlur();
                    void handleBlur(e.target.value);
                  }}
                />
                {isPolishing && (
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 rounded-b-md bg-background/90 px-2 py-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Redactando con IA…
                  </div>
                )}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <p className="mt-1.5 flex items-start gap-1 text-xs text-muted-foreground">
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
        Este relato se redacta automáticamente con IA para darle un tono más técnico y formal —
        ya sea que lo escribas o lo grabes por voz.
      </p>

      <AudioRecorderModal open={modalOpen} onOpenChange={setModalOpen} onComplete={handleRecordingComplete} />
    </div>
  );
}
