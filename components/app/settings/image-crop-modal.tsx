'use client';

import { useState, useRef } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Crop as CropIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { cropImageToBase64 } from '@/lib/image-utils';

type AspectRatio = 'square' | 'wide';

const ASPECT_OPTIONS: { value: AspectRatio; label: string; ratio: number }[] = [
  { value: 'square', label: 'Cuadrado (1:1)', ratio: 1 },
  { value: 'wide',   label: 'Rectangular (3:1)', ratio: 3 },
];

interface Props {
  src: string;
  onConfirm: (base64: string) => void;
  onCancel: () => void;
}

export function ImageCropModal({ src, onConfirm, onCancel }: Props) {
  const [aspect, setAspect] = useState<AspectRatio>('wide');
  const [crop, setCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const currentRatio = ASPECT_OPTIONS.find((o) => o.value === aspect)!.ratio;

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const c = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, currentRatio, width, height),
      width,
      height,
    );
    setCrop(c);
  }

  function handleAspectChange(v: AspectRatio) {
    setAspect(v);
    if (!imgRef.current) return;
    const { width, height } = imgRef.current;
    const ratio = ASPECT_OPTIONS.find((o) => o.value === v)!.ratio;
    const c = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, ratio, width, height),
      width,
      height,
    );
    setCrop(c);
  }

  function handleConfirm() {
    if (!imgRef.current || !crop) return;
    const base64 = cropImageToBase64(imgRef.current, crop);
    if (base64) onConfirm(base64);
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="h-4 w-4" />
            Recortar imagen
          </DialogTitle>
        </DialogHeader>

        {/* Aspect ratio selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Relación de aspecto:</span>
          {ASPECT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => handleAspectChange(o.value)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                aspect === o.value
                  ? 'bg-foreground text-background border-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Crop area */}
        <div className="flex max-h-[420px] items-center justify-center overflow-auto rounded-lg border bg-muted/40 p-3">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            aspect={currentRatio}
            keepSelection
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt="Recorte"
              onLoad={onImageLoad}
              style={{ maxHeight: '380px', maxWidth: '100%', objectFit: 'contain' }}
            />
          </ReactCrop>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="button" onClick={handleConfirm} disabled={!crop}>
            Aplicar recorte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
