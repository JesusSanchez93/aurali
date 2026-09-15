'use client';

import { useState } from 'react';
import { Control, FieldValues, Path, useFormContext } from 'react-hook-form';
import { Mic } from 'lucide-react';
import { Button } from '../../ui/button';
import { AudioRecorderModal } from '../audio-recorder-modal';
import { FormTextarea } from './form-textarea';

interface Props<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  rows?: number;
}

/** Textarea con botón "Grabar audio" que abre AudioRecorderModal y transcribe
 *  la grabación al campo de texto. Reutiliza el modal ya compartido usado por
 *  el flujo público de fraude bancario (InfoAboutEventsForm.tsx). */
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
  const { setValue } = useFormContext<T>();

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
      <FormTextarea control={control} name={name} label="" rows={rows} disabled={disabled} />
      <AudioRecorderModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onComplete={(text) =>
          setValue(name, text as never, { shouldDirty: true, shouldValidate: true })
        }
      />
    </div>
  );
}
