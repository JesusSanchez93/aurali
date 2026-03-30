'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import {
  type DocHeader, type DocFooter,
  createDocHeader, updateDocHeader, deleteDocHeader,
  createDocFooter, updateDocFooter, deleteDocFooter,
} from '@/app/[locale]/(dashboard)/settings/documents/actions';
import {
  HeaderFooterFormSheet,
  type FormValues,
  type ListItem,
  parseContent,
} from './header-footer-form-sheet';

// ─── Content structure ────────────────────────────────────────────────────────

type Alignment = 'left' | 'center' | 'right';
type DocContent = {
  image?: { url: string; alignment: Alignment } | null;
  text?: unknown;
};

function composeContent(values: FormValues): DocContent {
  return {
    image: values.image_url
      ? { url: values.image_url, alignment: values.image_alignment }
      : null,
    text: values.text_content,
  };
}

// ─── Generic list ─────────────────────────────────────────────────────────────

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
                    // eslint-disable-next-line @next/next/no-img-element
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

  function openNewHeader()           { setEditingHeader(null);  setHeaderSheet(true); }
  function openEditHeader(item: ListItem) { setEditingHeader(item); setHeaderSheet(true); }
  function openNewFooter()           { setEditingFooter(null);  setFooterSheet(true); }
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

      <HeaderFooterFormSheet
        open={headerSheet}
        onOpenChange={setHeaderSheet}
        title={editingHeader ? 'Editar cabecera' : 'Nueva cabecera'}
        editingItem={editingHeader}
        onSave={handleSaveHeader}
      />
      <HeaderFooterFormSheet
        open={footerSheet}
        onOpenChange={setFooterSheet}
        title={editingFooter ? 'Editar pie de página' : 'Nuevo pie de página'}
        editingItem={editingFooter}
        onSave={handleSaveFooter}
      />
    </>
  );
}
