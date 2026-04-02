'use client';

import { useEffect, useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { Loader2, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { FormInput } from '@/components/common/form/form-input';
import Tiptap from '@/components/common/tip-tap';
import type { DocumentTemplate } from './WorkflowEditor';
import type { WorkflowNode } from './types';

interface NodeEditDialogProps {
  node: WorkflowNode | null;
  templateId: string;
  onClose: () => void;
  onSave: (
    templateId: string,
    nodeId: string,
    config: { subject?: string; body?: unknown; attach_document_template_ids?: string[]; template_ids?: string[] },
  ) => Promise<void>;
  documentTemplates?: DocumentTemplate[];
}

interface FormValues {
  subject: string;
}

/** Convert a legacy plain-text body to TipTap-compatible HTML. */
function legacyToHtml(text: string): string {
  return text
    .split('\n\n')
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function resolveInitialBody(node: NodeEditDialogProps['node']): unknown {
  if (!node) return null;
  const raw = (node.data.config as Record<string, unknown>).body;
  if (!raw) return null;
  if (typeof raw === 'string') return legacyToHtml(raw);
  return raw;
}

function resolveInitialTemplateIds(node: NodeEditDialogProps['node']): string[] {
  if (!node) return [];
  const cfg = node.data.config as Record<string, unknown>;
  const isGenerateDoc = node.data.type === 'generate_document';
  const ids = isGenerateDoc ? cfg.template_ids : cfg.attach_document_template_ids;
  return Array.isArray(ids) ? (ids as string[]) : [];
}

interface TemplateSelectorProps {
  label: string;
  description?: string;
  icon?: React.JSX.Element;
  documentTemplates?: DocumentTemplate[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

function TemplateSelector({ label, description, icon, documentTemplates, selectedIds, onChange }: TemplateSelectorProps) {
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {!documentTemplates || documentTemplates.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">No hay plantillas de documentos creadas.</p>
      ) : (
        <div className="flex flex-col gap-1 rounded-md border p-2">
          {documentTemplates.map((tpl) => (
            <Label
              key={tpl.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted"
            >
              <Checkbox
                checked={selectedIds.includes(tpl.id)}
                onCheckedChange={() => toggle(tpl.id)}
              />
              <span className="text-xs">{tpl.name}</span>
            </Label>
          ))}
        </div>
      )}
    </div>
  );
}

export function NodeEditDialog({
  node,
  templateId,
  onClose,
  onSave,
  documentTemplates,
}: NodeEditDialogProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [bodyContent, setBodyContent] = useState<unknown>(() => resolveInitialBody(node));
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>(
    () => resolveInitialTemplateIds(node),
  );

  const form = useForm<FormValues>({
    defaultValues: { subject: String((node?.data.config as Record<string, unknown>)?.subject ?? '') },
  });
  const { handleSubmit, reset, control } = form;

  useEffect(() => {
    if (!node) return;
    const cfg = node.data.config as Record<string, unknown>;
    reset({ subject: String(cfg.subject ?? '') });
    setBodyContent(resolveInitialBody(node));
    setSelectedTemplateIds(resolveInitialTemplateIds(node));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  const isGenerateDoc = node?.data.type === 'generate_document';

  const onSubmit = async (values: FormValues) => {
    if (!node) return;
    setIsSaving(true);
    try {
      if (isGenerateDoc) {
        await onSave(templateId, node.id, { template_ids: selectedTemplateIds });
        toast.success('Nodo actualizado');
      } else {
        await onSave(templateId, node.id, {
          subject: values.subject,
          body: bodyContent,
          attach_document_template_ids: selectedTemplateIds,
        });
        toast.success('Correo actualizado');
      }
      router.refresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const cfg = node?.data.config as Record<string, unknown> | undefined;
  const hasAttachments = cfg?.attach_enabled === true;

  const VARIABLES = ['{{client.first_name}}', '{{client.last_name}}', '{{form_url}}', '{{process.id}}'];

  return (
    <Dialog open={!!node} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl p-0">
        <DialogHeader className='p-6'>
          <DialogTitle>
            {isGenerateDoc ? 'Configurar documentos — ' : 'Editar correo — '}
            {node?.data.title}
          </DialogTitle>
        </DialogHeader>

        <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">

          {/* ── generate_document: only template selector ── */}
          {isGenerateDoc && (
            <TemplateSelector
              label="Plantillas a generar"
              documentTemplates={documentTemplates}
              selectedIds={selectedTemplateIds}
              onChange={setSelectedTemplateIds}
            />
          )}

          {/* ── send_email / send_documents ── */}
          {!isGenerateDoc && (
            <>
              <FormInput
                control={control}
                name="subject"
                label="Asunto"
                placeholder="Asunto del correo"
              />

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Cuerpo del correo</span>
                <Tiptap key={node?.id} value={bodyContent} onChange={setBodyContent} menuBarStickyTop='-1px' />
                <div className="flex flex-wrap gap-1 pt-1">
                  {VARIABLES.map((v) => (
                    <code
                      key={v}
                      className="cursor-default rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {v}
                    </code>
                  ))}
                </div>
              </div>

              {hasAttachments && (
                <>
                  <Separator />
                  <TemplateSelector
                    label="Documentos a adjuntar"
                    description="Selecciona las plantillas cuyos PDFs generados se adjuntarán al correo."
                    icon={<Paperclip className="h-4 w-4 text-muted-foreground" />}
                    documentTemplates={documentTemplates}
                    selectedIds={selectedTemplateIds}
                    onChange={setSelectedTemplateIds}
                  />
                </>
              )}
            </>
          )}

          <DialogFooter className="mt-auto pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
