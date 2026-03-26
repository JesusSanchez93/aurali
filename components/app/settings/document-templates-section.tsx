'use client';

import { useState, useTransition, useRef, useCallback } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Star, AlignLeft, AlignCenter, AlignRight, ImagePlus, X, Crop as CropIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FormInput } from '@/components/common/form/form-input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Tiptap, { type TiptapHandle } from '@/components/common/tip-tap';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { cn } from '@/lib/utils';
import {
  type DocHeader, type DocFooter,
  createDocHeader, updateDocHeader, deleteDocHeader,
  createDocFooter, updateDocFooter, deleteDocFooter,
} from '@/app/[locale]/(dashboard)/settings/documents/actions';

// ─── Content structure ────────────────────────────────────────────────────────
type Alignment = 'left' | 'center' | 'right';
type AspectRatio = 'square' | 'wide';
type DocContent = {
  image?: { url: string; alignment: Alignment } | null;
  text?: unknown;
};

function parseContent(raw: unknown): { imageUrl: string; imageAlignment: Alignment; text: unknown } {
  const c = raw as DocContent | null;
  return {
    imageUrl: c?.image?.url ?? '',
    imageAlignment: c?.image?.alignment ?? 'left',
    text: c?.text ?? undefined,
  };
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().trim().min(1, 'Campo requerido'),
  image_url: z.string().optional(),
  image_alignment: z.enum(['left', 'center', 'right']).default('left'),
  text_content: z.unknown(),
  is_default: z.boolean().default(false),
});
type FormValues = z.infer<typeof schema>;

// ─── Crop helper: canvas → base64 ─────────────────────────────────────────────
function cropImageToBase64(
  image: HTMLImageElement,
  crop: Crop,
  mimeType = 'image/png',
): string {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = Math.round(crop.width * scaleX);
  canvas.height = Math.round(crop.height * scaleY);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.toDataURL(mimeType);
}

// ─── Crop modal ───────────────────────────────────────────────────────────────
const ASPECT_OPTIONS: { value: AspectRatio; label: string; ratio: number }[] = [
  { value: 'square',  label: 'Cuadrado (1:1)',     ratio: 1 },
  { value: 'wide',    label: 'Rectangular (3:1)',  ratio: 3 },
];

function CropModal({
  src,
  onConfirm,
  onCancel,
}: {
  src: string;
  onConfirm: (base64: string) => void;
  onCancel: () => void;
}) {
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

// ─── Alignment picker ─────────────────────────────────────────────────────────
function AlignPicker({ value, onChange }: { value: Alignment; onChange: (v: Alignment) => void }) {
  const options: { val: Alignment; icon: React.ReactNode }[] = [
    { val: 'left',   icon: <AlignLeft  className="h-4 w-4" /> },
    { val: 'center', icon: <AlignCenter className="h-4 w-4" /> },
    { val: 'right',  icon: <AlignRight className="h-4 w-4" /> },
  ];
  return (
    <div className="flex gap-1">
      {options.map(({ val, icon }) => (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
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
          onClick={() => onChange('')}
          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
        >
          <X className="h-3 w-3" />
        </button>
        {rawSrc && (
          <CropModal
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
        <CropModal
          src={rawSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setRawSrc(null)}
        />
      )}
    </>
  );
}

// ─── Generic list item ───────────────────────────────────────────────────────
type ListItem = { id: string; name: string; content: unknown; is_default: boolean; created_at: string };

function ItemsList({
  items,
  onNew,
  onEdit,
  onDelete,
}: {
  items: ListItem[];
  onNew: () => void;
  onEdit: (item: ListItem) => void;
  onDelete: (id: string) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={onNew}>
          <Plus className="mr-1 h-4 w-4" /> Nueva
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay entradas aún.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const { imageUrl } = parseContent(item.content);
            return (
              <div key={item.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div className="flex items-center gap-3">
                  {imageUrl && (
                    <img src={imageUrl} alt="" className="h-8 w-16 rounded border object-contain" />
                  )}
                  <span className="text-sm font-medium">{item.name}</span>
                  {item.is_default && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Star className="h-3 w-3" /> Default
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeletingId(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={() => { if (deletingId) onDelete(deletingId); }}
        title="¿Eliminar?"
        description="Esta acción no se puede deshacer."
        variant="destructive"
      />
    </div>
  );
}

// ─── Editor sheet ────────────────────────────────────────────────────────────
function EditorSheet({
  open,
  onOpenChange,
  title,
  editingItem,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  editingItem: ListItem | null;
  onSave: (values: FormValues) => Promise<void>;
}) {
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
    resolver: zodResolver(schema),
    defaultValues: defaultValues(),
    values: defaultValues(),
  });

  function handleSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        await onSave(values);
        form.reset();
        onOpenChange(false);
      } catch {
        toast.error('Error al guardar');
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <FormInput control={form.control} name="name" label="Nombre" required />

              {/* Image section */}
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Imagen</p>
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
                <p className="text-sm font-medium">Texto</p>
                <FormField
                  control={form.control}
                  name="text_content"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Tiptap ref={tiptapRef} value={field.value} onChange={field.onChange} />
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
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Compose content for DB ───────────────────────────────────────────────────
function composeContent(values: FormValues): DocContent {
  return {
    image: values.image_url
      ? { url: values.image_url, alignment: values.image_alignment }
      : null,
    text: values.text_content,
  };
}

// ─── Main section ─────────────────────────────────────────────────────────────
type Props = {
  headers: DocHeader[];
  footers: DocFooter[];
};

export default function DocumentTemplatesSection({ headers: initialHeaders, footers: initialFooters }: Props) {
  const [headers, setHeaders] = useState<ListItem[]>(initialHeaders);
  const [footers, setFooters] = useState<ListItem[]>(initialFooters);

  const [headerSheet, setHeaderSheet] = useState(false);
  const [footerSheet, setFooterSheet] = useState(false);
  const [editingHeader, setEditingHeader] = useState<ListItem | null>(null);
  const [editingFooter, setEditingFooter] = useState<ListItem | null>(null);

  const [, startTransition] = useTransition();

  function openNewHeader() { setEditingHeader(null); setHeaderSheet(true); }
  function openEditHeader(item: ListItem) { setEditingHeader(item); setHeaderSheet(true); }
  function openNewFooter() { setEditingFooter(null); setFooterSheet(true); }
  function openEditFooter(item: ListItem) { setEditingFooter(item); setFooterSheet(true); }

  async function handleSaveHeader(values: FormValues) {
    const content = composeContent(values);
    const payload = { name: values.name, content, is_default: values.is_default };
    if (editingHeader) {
      await updateDocHeader(editingHeader.id, payload);
      setHeaders((prev) => prev.map((h) =>
        h.id === editingHeader.id
          ? { ...h, name: values.name, content, is_default: values.is_default }
          : values.is_default ? { ...h, is_default: false } : h
      ));
      toast.success('Cabecera guardada');
    } else {
      await createDocHeader(payload);
      toast.success('Cabecera creada');
      window.location.reload();
    }
  }

  async function handleSaveFooter(values: FormValues) {
    const content = composeContent(values);
    const payload = { name: values.name, content, is_default: values.is_default };
    if (editingFooter) {
      await updateDocFooter(editingFooter.id, payload);
      setFooters((prev) => prev.map((f) =>
        f.id === editingFooter.id
          ? { ...f, name: values.name, content, is_default: values.is_default }
          : values.is_default ? { ...f, is_default: false } : f
      ));
      toast.success('Pie de página guardado');
    } else {
      await createDocFooter(payload);
      toast.success('Pie de página creado');
      window.location.reload();
    }
  }

  function handleDeleteHeader(id: string) {
    startTransition(async () => {
      try {
        await deleteDocHeader(id);
        setHeaders((prev) => prev.filter((h) => h.id !== id));
        toast.success('Eliminado');
      } catch { toast.error('Error al eliminar'); }
    });
  }

  function handleDeleteFooter(id: string) {
    startTransition(async () => {
      try {
        await deleteDocFooter(id);
        setFooters((prev) => prev.filter((f) => f.id !== id));
        toast.success('Eliminado');
      } catch { toast.error('Error al eliminar'); }
    });
  }

  return (
    <>
      <Tabs defaultValue="headers">
        <TabsList>
          <TabsTrigger value="headers">Cabeceras</TabsTrigger>
          <TabsTrigger value="footers">Pies de página</TabsTrigger>
        </TabsList>

        <TabsContent value="headers" className="mt-4">
          <ItemsList items={headers} onNew={openNewHeader} onEdit={openEditHeader} onDelete={handleDeleteHeader} />
        </TabsContent>

        <TabsContent value="footers" className="mt-4">
          <ItemsList items={footers} onNew={openNewFooter} onEdit={openEditFooter} onDelete={handleDeleteFooter} />
        </TabsContent>
      </Tabs>

      <EditorSheet
        open={headerSheet}
        onOpenChange={setHeaderSheet}
        title={editingHeader ? 'Editar cabecera' : 'Nueva cabecera'}
        editingItem={editingHeader}
        onSave={handleSaveHeader}
      />
      <EditorSheet
        open={footerSheet}
        onOpenChange={setFooterSheet}
        title={editingFooter ? 'Editar pie de página' : 'Nuevo pie de página'}
        editingItem={editingFooter}
        onSave={handleSaveFooter}
      />
    </>
  );
}
