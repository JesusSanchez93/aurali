'use client';

import { useTransition, useRef, useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlignLeft, AlignCenter, AlignRight, ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import Sheet from '@/components/common/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FormInput } from '@/components/common/form/form-input';
import Tiptap, { type TiptapHandle } from '@/components/common/tip-tap';
import { cn } from '@/lib/utils';
import { ImageCropModal } from './image-crop-modal';

// ─── Shared types ─────────────────────────────────────────────────────────────

export type Alignment = 'left' | 'center' | 'right';

export type ListItem = {
  id: string;
  name: string;
  content: unknown;
  is_default: boolean;
  created_at: string;
};

type DocContent = {
  image?: { url: string; alignment: Alignment } | null;
  text?: unknown;
};

export const headerFooterSchema = z.object({
  name: z.string().trim().min(1, 'Campo requerido'),
  image_url: z.string().optional(),
  image_alignment: z.enum(['left', 'center', 'right']).default('left'),
  text_content: z.unknown(),
  is_default: z.boolean().default(false),
});

export type FormValues = z.infer<typeof headerFooterSchema>;

export function parseContent(raw: unknown): { imageUrl: string; imageAlignment: Alignment; text: unknown } {
  const c = raw as DocContent | null;
  return {
    imageUrl: c?.image?.url ?? '',
    imageAlignment: c?.image?.alignment ?? 'left',
    text: c?.text ?? undefined,
  };
}

// ─── Alignment picker ─────────────────────────────────────────────────────────

function AlignPicker({ value, onChange }: { value: Alignment; onChange: (v: Alignment) => void }) {
  const options: { val: Alignment; icon: React.ReactNode; label: string }[] = [
    { val: 'left',   icon: <AlignLeft  className="h-4 w-4" />, label: 'Alinear a la izquierda' },
    { val: 'center', icon: <AlignCenter className="h-4 w-4" />, label: 'Centrar' },
    { val: 'right',  icon: <AlignRight className="h-4 w-4" />, label: 'Alinear a la derecha' },
  ];
  return (
    <div className="flex gap-1">
      {options.map(({ val, icon, label }) => (
        <button
          key={val}
          type="button"
          aria-label={label}
          aria-pressed={value === val}
          onClick={() => onChange(val)}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-md border transition-colors',
            value === val
              ? 'bg-foreground text-background border-foreground'
              : 'bg-background text-muted-foreground hover:bg-muted',
          )}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

// ─── Image picker with crop ───────────────────────────────────────────────────

function ImagePicker({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rawSrc, setRawSrc] = useState<string | null>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRawSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  function handleCropConfirm(base64: string) {
    onChange(base64);
    setRawSrc(null);
  }

  if (value) {
    return (
      <div className="relative inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="Vista previa" className="max-h-24 rounded-md border object-contain" />
        <button
          type="button"
          aria-label="Quitar imagen"
          onClick={() => onChange('')}
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
        >
          <X className="h-3 w-3" />
        </button>
        {rawSrc && (
          <ImageCropModal
            src={rawSrc}
            onConfirm={handleCropConfirm}
            onCancel={() => setRawSrc(null)}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-20 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 text-sm text-muted-foreground transition hover:border-muted-foreground/60 hover:text-foreground"
      >
        <ImagePlus className="h-5 w-5" />
        Subir imagen
      </button>
      {rawSrc && (
        <ImageCropModal
          src={rawSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setRawSrc(null)}
        />
      )}
    </>
  );
}

// ─── Main form sheet ──────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  editingItem: ListItem | null;
  onSave: (values: FormValues) => Promise<void>;
}

export function HeaderFooterFormSheet({ open, onOpenChange, title, editingItem, onSave }: Props) {
  const [isPending, startTransition] = useTransition();
  const tiptapRef = useRef<TiptapHandle>(null);

  const defaultValues = (): FormValues => {
    if (editingItem) {
      const { imageUrl, imageAlignment, text } = parseContent(editingItem.content);
      return {
        name: editingItem.name,
        image_url: imageUrl,
        image_alignment: imageAlignment,
        text_content: text,
        is_default: editingItem.is_default,
      };
    }
    return { name: '', image_url: '', image_alignment: 'left', text_content: undefined, is_default: false };
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(headerFooterSchema),
    defaultValues: defaultValues(),
    values: defaultValues(),
  });

  function handleSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        // Read text_content directly from the editor to avoid react-hook-form
        // tracking issues with complex TipTap JSON objects.
        const editorContent = tiptapRef.current?.getContent() ?? values.text_content;
        await onSave({ ...values, text_content: editorContent });
        form.reset();
        onOpenChange(false);
      } catch {
        toast.error('Error al guardar');
      }
    });
  }

  const formBody = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormInput control={form.control} name="name" label="Nombre" required />

        {/* Image section */}
        <div className="space-y-3 rounded-lg border p-4">
          <span className="text-sm font-medium">Imagen</span>
          <FormField
            control={form.control}
            name="image_url"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <ImagePicker value={field.value ?? ''} onChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          {form.watch('image_url') && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Posición:</span>
              <FormField
                control={form.control}
                name="image_alignment"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <AlignPicker
                        value={field.value as Alignment}
                        onChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>

        {/* Text section */}
        <div className="space-y-3 rounded-lg border p-4">
          <span className="text-sm font-medium">Texto</span>
          <FormField
            control={form.control}
            name="text_content"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Tiptap ref={tiptapRef} value={field.value} onChange={field.onChange} menuBarStickyTop="0px"/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Default toggle */}
        <FormField
          control={form.control}
          name="is_default"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-2">
                <Switch id="is_default" checked={field.value} onCheckedChange={field.onChange} />
                <Label htmlFor="is_default">Usar como default</Label>
              </div>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Form>
  );

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="2xl"
      className="flex-col p-4"
      body={formBody}
    />
  );
}
