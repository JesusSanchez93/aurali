'use client';

/**
 * SignatureInput
 *
 * Three-tab component for capturing a signature:
 *   1. Dibujar  — freehand canvas via signature_pad
 *   2. Escribir — typed text rendered in a cursive font
 *   3. Imagen   — upload + crop (reuses ImageCropModal)
 *
 * Calls `onConfirm(base64DataUrl)` with a PNG data URL.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { getStroke } from 'perfect-freehand';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageCropModal } from '@/components/app/settings/image-crop-modal';
import { Eraser, ImagePlus, PenLine, Type } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Signature fonts (loaded via <link> in <head> by SignatureFonts) ─────────

const FONTS: { id: string; family: string; label: string }[] = [
  { id: 'dancing',    family: '"Dancing Script", cursive',      label: 'Clásica' },
  { id: 'greatvibes', family: '"Great Vibes", cursive',         label: 'Elegante' },
  { id: 'caveat',     family: '"Caveat", cursive',              label: 'Natural' },
  { id: 'pacifico',   family: '"Pacifico", cursive',            label: 'Redondeada' },
];

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Great+Vibes&family=Caveat:wght@600&family=Pacifico&display=swap';

/** Injects the Google Fonts stylesheet once */
function useSignatureFonts() {
  useEffect(() => {
    if (document.querySelector('link[data-signature-fonts]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    link.dataset.signatureFonts = '1';
    document.head.appendChild(link);
  }, []);
}

// ─── Color picker ─────────────────────────────────────────────────────────────

const COLORS = [
  { id: 'black', value: '#1a1a1a' },
  { id: 'blue',  value: '#1d4ed8' },
  { id: 'red',   value: '#dc2626' },
] as const;

type ColorValue = typeof COLORS[number]['value'];

function ColorPicker({
  color,
  onChange,
}: {
  color: ColorValue;
  onChange: (c: ColorValue) => void;
}) {
  return (
    <div className="absolute bottom-2.5 right-2.5 flex gap-1.5 z-10">
      {COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(c.value); }}
          className={cn(
            'h-5 w-5 rounded-full border-2 transition-transform hover:scale-110',
            color === c.value ? 'border-foreground scale-110 shadow-sm' : 'border-white/80 shadow',
          )}
          style={{ backgroundColor: c.value }}
          aria-label={c.id}
        />
      ))}
    </div>
  );
}

// ─── perfect-freehand helpers ─────────────────────────────────────────────────

const STROKE_OPTIONS = {
  size: 4,
  thinning: 0.6,
  smoothing: 0.5,
  streamline: 0.5,
  simulatePressure: true,
};

/** Converts a perfect-freehand stroke (array of [x,y]) to an SVG path `d` string. */
function getSvgPathFromStroke(stroke: number[][]): string {
  if (stroke.length < 2) return '';
  const [first, ...rest] = stroke;
  const d = [`M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`];
  for (let i = 0; i < rest.length - 1; i++) {
    const [x0, y0] = rest[i];
    const [x1, y1] = rest[i + 1];
    d.push(`Q ${x0.toFixed(2)} ${y0.toFixed(2)} ${((x0 + x1) / 2).toFixed(2)} ${((y0 + y1) / 2).toFixed(2)}`);
  }
  const last = rest[rest.length - 1];
  d.push(`L ${last[0].toFixed(2)} ${last[1].toFixed(2)}`);
  d.push('Z');
  return d.join(' ');
}

// ─── Draw tab ─────────────────────────────────────────────────────────────────

function DrawTab({ onResult }: { onResult: (b64: string) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [strokes, setStrokes] = useState<number[][][]>([]);
  const [currentStroke, setCurrentStroke] = useState<number[][] | null>(null);
  const [color, setColor] = useState<ColorValue>(COLORS[0].value);

  const isEmpty = strokes.length === 0 && !currentStroke;

  function getPoint(e: React.PointerEvent<SVGSVGElement>): number[] {
    const rect = svgRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top, e.pressure || 0.5];
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    (e.target as Element).setPointerCapture(e.pointerId);
    setCurrentStroke([getPoint(e)]);
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!currentStroke) return;
    setCurrentStroke((prev) => [...(prev ?? []), getPoint(e)]);
  }

  function handlePointerUp() {
    if (currentStroke && currentStroke.length > 0) {
      setStrokes((prev) => [...prev, currentStroke]);
    }
    setCurrentStroke(null);
  }

  function handleClear() {
    setStrokes([]);
    setCurrentStroke(null);
  }

  function handleConfirm() {
    if (strokes.length === 0) return;
    const svgEl = svgRef.current!;
    const { width, height } = svgEl.getBoundingClientRect();

    svgEl.setAttribute('width', String(width));
    svgEl.setAttribute('height', String(height));
    const svgData = new XMLSerializer().serializeToString(svgEl);
    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');

    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const ratio = window.devicePixelRatio || 1;
      const canvas = document.createElement('canvas');
      canvas.width  = width  * ratio;
      canvas.height = height * ratio;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(ratio, ratio);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      onResult(canvas.toDataURL('image/png'));
    };
    img.src = url;
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-lg border-2 border-dashed border-muted-foreground/30 bg-white overflow-hidden">
        <svg
          ref={svgRef}
          className="block w-full touch-none cursor-crosshair"
          style={{ height: 200 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <rect width="100%" height="100%" fill="transparent" />
          {strokes.map((pts, i) => (
            <path
              key={i}
              d={getSvgPathFromStroke(getStroke(pts, STROKE_OPTIONS))}
              fill={color}
            />
          ))}
          {currentStroke && currentStroke.length > 0 && (
            <path
              d={getSvgPathFromStroke(getStroke(currentStroke, STROKE_OPTIONS))}
              fill={color}
            />
          )}
        </svg>

        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-muted-foreground/50 select-none">
              Dibuja tu firma aquí
            </p>
          </div>
        )}

        <span className="pointer-events-none absolute left-[8%] right-[8%] top-[70%] border-t border-dashed border-slate-300" />
        <ColorPicker color={color} onChange={setColor} />
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={isEmpty}>
          <Eraser className="mr-1.5 h-4 w-4" />
          Limpiar
        </Button>
        <Button type="button" size="sm" onClick={handleConfirm} disabled={isEmpty}>
          Usar firma
        </Button>
      </div>
    </div>
  );
}

// ─── Type tab ─────────────────────────────────────────────────────────────────

function TypeTab({ onResult }: { onResult: (b64: string) => void }) {
  useSignatureFonts();

  const [text, setText]     = useState('');
  const [fontId, setFontId] = useState(FONTS[0].id);
  const [color, setColor]   = useState<ColorValue>(COLORS[0].value);
  const previewRef          = useRef<HTMLDivElement>(null);

  const selectedFont = FONTS.find((f) => f.id === fontId)!;

  function handleConfirm() {
    if (!text.trim() || !previewRef.current) return;

    const el = previewRef.current;
    const { width, height } = el.getBoundingClientRect();

    const canvas = document.createElement('canvas');
    const ratio  = window.devicePixelRatio || 1;
    canvas.width  = width  * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(ratio, ratio);

    const fontSize = Math.min(height * 0.6, 72);
    ctx.font         = `${fontSize}px ${selectedFont.family}`;
    ctx.fillStyle    = color;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    onResult(canvas.toDataURL('image/png'));
  }

  return (
    <div className="space-y-3">
      {/* Text input */}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Escribe tu nombre"
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
      />

      {/* Font picker */}
      <div className="flex gap-2 flex-wrap">
        {FONTS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFontId(f.id)}
            className={cn(
              'rounded-md border px-3 py-1 text-xs transition-colors',
              fontId === f.id
                ? 'border-foreground bg-foreground text-background'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Preview */}
      <div className="relative">
        <div
          ref={previewRef}
          className="flex h-[200px] w-full items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-white overflow-hidden px-4"
          style={{ fontFamily: selectedFont.family, fontSize: 'clamp(28px, 8vw, 64px)', color, lineHeight: 1 }}
        >
          {text || <span className="text-muted-foreground/40 text-sm font-sans">Vista previa</span>}
          <span className="pointer-events-none absolute left-[8%] right-[8%] top-[70%] border-t border-dashed border-slate-300" />
        </div>
        <ColorPicker color={color} onChange={setColor} />
      </div>

      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={handleConfirm} disabled={!text.trim()}>
          Usar firma
        </Button>
      </div>
    </div>
  );
}

// ─── Upload tab ───────────────────────────────────────────────────────────────

function UploadTab({ onResult }: { onResult: (b64: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rawSrc, setRawSrc] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRawSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-[160px] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 text-sm text-muted-foreground transition hover:border-muted-foreground/60 hover:text-foreground"
      >
        <ImagePlus className="h-8 w-8 opacity-40" />
        <span>Haz clic para subir una imagen</span>
        <span className="text-xs opacity-60">PNG, JPG, WEBP</span>
      </button>

      {rawSrc && (
        <ImageCropModal
          src={rawSrc}
          onConfirm={(b64) => { setRawSrc(null); onResult(b64); }}
          onCancel={() => setRawSrc(null)}
        />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onConfirm: (base64: string) => void;
  onCancel: () => void;
}

export function SignatureInput({ onConfirm, onCancel }: Props) {
  const handleResult = useCallback((b64: string) => {
    onConfirm(b64);
  }, [onConfirm]);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="draw">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="draw" className="gap-1.5">
            <PenLine className="h-3.5 w-3.5" />
            Dibujar
          </TabsTrigger>
          <TabsTrigger value="type" className="gap-1.5">
            <Type className="h-3.5 w-3.5" />
            Escribir
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-1.5">
            <ImagePlus className="h-3.5 w-3.5" />
            Imagen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draw" className="mt-4">
          <DrawTab onResult={handleResult} />
        </TabsContent>
        <TabsContent value="type" className="mt-4">
          <TypeTab onResult={handleResult} />
        </TabsContent>
        <TabsContent value="upload" className="mt-4">
          <UploadTab onResult={handleResult} />
        </TabsContent>
      </Tabs>

      <div className="border-t pt-3 flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
