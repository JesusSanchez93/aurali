'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FileText, Plus, Pencil, Trash2, ExternalLink, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  type GoogleDocTemplate,
  type GoogleConnectionStatus,
  createGoogleDocTemplate,
  updateGoogleDocTemplate,
  deleteGoogleDocTemplate,
} from '../actions';

interface Props {
  templates: GoogleDocTemplate[];
  connection: GoogleConnectionStatus;
  locale: string;
}

interface FormState {
  name: string;
  googleDocUrl: string;
  description: string;
}

const emptyForm: FormState = {
  name: '',
  googleDocUrl: '',
  description: '',
};

export function GoogleTemplatesSection({ templates, connection, locale }: Props) {
  const [isPending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GoogleDocTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  void locale;

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(t: GoogleDocTemplate) {
    setEditing(t);
    setForm({
      name: t.name,
      googleDocUrl: t.google_doc_id,
      description: t.description ?? '',
    });
    setFormOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.googleDocUrl.trim()) {
      toast.error('El nombre y la URL del documento son requeridos');
      return;
    }
    startTransition(async () => {
      try {
        if (editing) {
          await updateGoogleDocTemplate(editing.id, {
            name: form.name,
            googleDocUrl: form.googleDocUrl,
            description: form.description || undefined,
          });
          toast.success('Plantilla actualizada');
        } else {
          await createGoogleDocTemplate({
            name: form.name,
            googleDocUrl: form.googleDocUrl,
            description: form.description || undefined,
          });
          toast.success('Plantilla creada');
        }
        setFormOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al guardar');
      }
    });
  }

  function handleDelete() {
    if (!deleteId) return;
    startTransition(async () => {
      try {
        await deleteGoogleDocTemplate(deleteId);
        toast.success('Plantilla eliminada');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al eliminar');
      } finally {
        setDeleteId(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Plantillas de Google Docs</h2>
          <p className="text-sm text-muted-foreground">
            Usa Google Docs como plantilla. Las variables <code className="rounded bg-muted px-1 text-xs">{'{VARIABLE_NOMBRE}'}</code> se sustituyen al generar el PDF.
          </p>
        </div>
        <Button size="sm" onClick={openNew} disabled={!connection.connected}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva plantilla
        </Button>
      </div>

      {/* Aviso si no está conectado */}
      {!connection.connected && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Conecta tu cuenta de Google arriba para poder crear y usar plantillas de Google Docs.
          </span>
        </div>
      )}

      {/* Tabla */}
      {templates.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center animate-in fade-in-50">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No hay plantillas de Google Doc. Crea la primera usando el botón de arriba.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Google Doc</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Creado</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((tpl, index) => (
                <tr
                  key={tpl.id}
                  className="border-b last:border-0 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <td className="px-4 py-3 font-medium">{tpl.name}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`https://docs.google.com/document/d/${tpl.google_doc_id}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {tpl.google_doc_id.slice(0, 18)}…
                      </Badge>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(tpl.created_at).toLocaleDateString('es-CO', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(tpl)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isPending}
                        onClick={() => setDeleteId(tpl.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar plantilla' : 'Nueva plantilla de Google Doc'}
            </DialogTitle>
            <DialogDescription>
              El documento debe ser accesible por la cuenta de Google conectada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gdt-name">Nombre de la plantilla</Label>
              <Input
                id="gdt-name"
                placeholder="Ej: Poder notarial, Carta al banco…"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gdt-url">URL del Google Doc</Label>
              <Input
                id="gdt-url"
                placeholder="https://docs.google.com/document/d/…"
                value={form.googleDocUrl}
                onChange={(e) => setForm((f) => ({ ...f, googleDocUrl: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Copia el enlace desde Google Docs → Compartir → Copiar enlace.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gdt-desc">Descripción <span className="text-muted-foreground">(opcional)</span></Label>
              <Textarea
                id="gdt-desc"
                placeholder="Describe para qué se usa esta plantilla…"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {editing ? 'Guardar cambios' : 'Crear plantilla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar plantilla"
        description="¿Estás seguro de que deseas eliminar esta plantilla? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
      />
    </div>
  );
}
