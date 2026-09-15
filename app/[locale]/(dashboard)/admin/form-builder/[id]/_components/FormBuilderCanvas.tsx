'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ArrowLeft, Check, Copy, Eye, Loader2, Pencil, Plus, Rocket, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Accordion } from '@/components/ui/accordion';
import { Link } from '@/i18n/routing';
import { toast } from '@/lib/toast';
import { useDebounce } from '@/hooks/use-debounce';
import type { CatalogOptionsSource, FormFieldOption, FormFieldSchema, FormSchema, FormSection } from '@/lib/forms/types';
import {
  publishSchemaAction,
  saveDraftSchema,
  updateFormWorkflowTemplate,
  type FormSchemaRow,
  type WorkflowTemplateOption,
} from '../actions';
import { SectionEditor } from './SectionEditor';
import { FieldConfigPanel } from './FieldConfigPanel';
import { FormPreview } from './FormPreview';

interface Props {
  initialSchemaRow: FormSchemaRow;
  catalogOptions: Record<CatalogOptionsSource, FormFieldOption[]>;
  workflowTemplateOptions: WorkflowTemplateOption[];
}

let sectionCounter = 0;
function newSection(order: number): FormSection {
  sectionCounter += 1;
  return {
    id: crypto.randomUUID(),
    key: `seccion-${order + 1}-${sectionCounter}`,
    title: 'Nueva sección',
    order,
    fields: [],
  };
}

/** Schemas guardados antes de que `FormSection.id` existiera no lo traen —
 *  se les asigna uno al cargar para que el builder tenga identidad estable
 *  desde el primer render (evita que editar el slug remonte la sección). */
function withSectionIds(schema: FormSchema): FormSchema {
  return {
    ...schema,
    sections: schema.sections.map((s) => (s.id ? s : { ...s, id: crypto.randomUUID() })),
  };
}

const sectionId = (s: FormSection) => s.id ?? s.key;

const AUTOSAVE_DELAY_MS = 1500;

export function FormBuilderCanvas({ initialSchemaRow, catalogOptions, workflowTemplateOptions }: Props) {
  const [schemaId] = useState(initialSchemaRow.id);
  const [nameDraft, setNameDraft] = useState(initialSchemaRow.name);
  const [name, setName] = useState(initialSchemaRow.name);
  const debouncedNameDraft = useDebounce(nameDraft, 400);
  useEffect(() => {
    setName(debouncedNameDraft);
  }, [debouncedNameDraft]);
  const [workflowTemplateId, setWorkflowTemplateId] = useState(initialSchemaRow.workflow_template_id);
  const [isChangingTemplate, startChangingTemplate] = useTransition();
  const [schema, setSchema] = useState<FormSchema>(
    withSectionIds(initialSchemaRow.schema ?? { version: 1, sections: [] }),
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isPublishing, startPublishing] = useTransition();
  const [codeCopied, setCodeCopied] = useState(false);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'pending' | 'saved'>('idle');
  const [openSectionId, setOpenSectionId] = useState<string | null>(() => {
    const first = [...(initialSchemaRow.schema?.sections ?? [])].sort((a, b) => a.order - b.order)[0];
    return first ? sectionId(first) : null;
  });
  // Campo actualmente abierto en el panel de detalle — vive acá (no dentro de
  // SectionEditor) para poder navegar entre campos de secciones distintas con
  // las flechas del panel. `sectionIndex` referencia schema.sections (no la
  // lista ordenada por `order`).
  const [editingField, setEditingField] = useState<{ sectionIndex: number; fieldIndex: number } | null>(null);
  // Última versión (name + schema) efectivamente persistida — usado para que
  // el autoguardado se salte cuando no hay cambios reales desde el último
  // guardado, en vez de un flag de "primer render": React Strict Mode
  // invoca dos veces los efectos al montar, y un simple flag de primera vez
  // no sobrevive esa segunda invocación (dispararía un autoguardado fantasma
  // apenas se abre el formulario, sin que el usuario edite nada).
  const lastSavedRef = useRef(JSON.stringify({ name: initialSchemaRow.name, schema }));
  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Autoguardado del borrador mientras se diseña: cada cambio en `schema` o
  // `name` dispara un guardado debounced, sin bloquear la edición ni requerir
  // que el super_admin recuerde presionar "Guardar borrador".
  useEffect(() => {
    const serialized = JSON.stringify({ name, schema });
    if (serialized === lastSavedRef.current) return;

    setAutosaveState('pending');
    const timeout = setTimeout(() => {
      saveDraftSchema(schemaId, name, schema)
        .then(() => {
          lastSavedRef.current = serialized;
          setAutosaveState('saved');
        })
        .catch((err) => {
          setAutosaveState('idle');
          toast.error(err instanceof Error ? err.message : 'Error al autoguardar el borrador');
        });
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, name]);

  // Copia el token completo (no solo el código) para pegar directo en el
  // cuerpo del nodo "Enviar Correo" del workflow — reemplaza el token base
  // {FORM_URL} por uno que referencia explícitamente este formulario.
  const handleCopyCode = () => {
    navigator.clipboard.writeText(`{FORM_URL:${initialSchemaRow.code}}`).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    });
  };

  const handleWorkflowTemplateChange = (newId: string) => {
    if (newId === workflowTemplateId) return;
    const previousId = workflowTemplateId;
    startChangingTemplate(async () => {
      try {
        await updateFormWorkflowTemplate(schemaId, newId);
        setWorkflowTemplateId(newId);
        toast.success('Tipo de flujo actualizado');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al cambiar el tipo de flujo');
        setWorkflowTemplateId(previousId);
      }
    });
  };

  const addSection = () => {
    const section = newSection(schema.sections.length);
    setSchema((prev) => ({ ...prev, sections: [...prev.sections, section] }));
    setOpenSectionId(sectionId(section));
  };

  const updateSection = (index: number, section: FormSection) => {
    setSchema((prev) => {
      const sections = [...prev.sections];
      sections[index] = section;
      return { ...prev, sections };
    });
  };

  const removeSection = (index: number) => {
    setSchema((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })),
    }));
  };

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSchema((prev) => {
      const sorted = [...prev.sections].sort((a, b) => a.order - b.order);
      const oldIndex = sorted.findIndex((s) => sectionId(s) === active.id);
      const newIndex = sorted.findIndex((s) => sectionId(s) === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;

      const reordered = arrayMove(sorted, oldIndex, newIndex);
      return { ...prev, sections: reordered.map((s, i) => ({ ...s, order: i })) };
    });
  };

  const handleSaveDraft = () => {
    startSaving(async () => {
      try {
        await saveDraftSchema(schemaId, name, schema);
        lastSavedRef.current = JSON.stringify({ name, schema });
        setAutosaveState('saved');
        toast.success('Borrador guardado');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al guardar el borrador');
      }
    });
  };

  const handlePublish = () => {
    startPublishing(async () => {
      try {
        await saveDraftSchema(schemaId, name, schema);
        lastSavedRef.current = JSON.stringify({ name, schema });
        await publishSchemaAction(schemaId);
        toast.success('Formulario publicado');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al publicar');
      }
    });
  };

  const isBusy = isSaving || isPublishing;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-6">
      <div className="flex flex-col gap-4">
        {/* Bloque 1: volver + nombre del formulario */}
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/admin/form-builder">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <InputGroup >
            <InputGroupInput
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Nombre del formulario"
              title="Editar nombre del formulario"
              className="text-lg font-semibold"
            />
            <InputGroupAddon align="inline-end">
              <Pencil className="h-3.5 w-3.5" />
            </InputGroupAddon>
          </InputGroup>
          <button
            type="button"
            onClick={handleCopyCode}
            title="Copiar token — pégalo en el cuerpo del nodo Enviar Correo para enlazar este formulario"
            className="ml-2 flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            {codeCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            <span className="font-mono">{`{FORM_URL:${initialSchemaRow.code}}`}</span>
          </button>
        </div>

        {/* Bloque 2: indicador de autoguardado + acciones */}
        <div className="flex items-center justify-end gap-3">
          {autosaveState !== 'idle' && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {autosaveState === 'pending' ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Guardando…
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  Borrador guardado
                </>
              )}
            </span>
          )}
          <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="mr-1.5 h-4 w-4" />
            Vista previa
          </Button>
          <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isBusy}>
            {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Borrador
          </Button>
          <Button type="button" onClick={handlePublish} disabled={isBusy}>
            {isPublishing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Rocket className="mr-1.5 h-4 w-4" />}
            Publicar
          </Button>
        </div>
      </div>

      {/* Tipo de flujo al que pertenece este formulario — editable: a futuro
          un mismo flujo podrá tener más de un formulario asociado. */}
      <div className="flex items-center gap-3 rounded-lg border p-4">
        <Label className="shrink-0 text-sm font-medium">Tipo de flujo</Label>
        <Select value={workflowTemplateId} onValueChange={handleWorkflowTemplateChange} disabled={isChangingTemplate}>
          <SelectTrigger className="w-full max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {workflowTemplateOptions.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isChangingTemplate && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {(() => {
        const sortedSections = [...schema.sections].sort((a, b) => a.order - b.order);
        return (
          <DndContext
            id="form-builder-sections-dnd"
            sensors={sectionSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSectionDragEnd}
          >
            <SortableContext items={sortedSections.map(sectionId)} strategy={verticalListSortingStrategy}>
              <Accordion
                type="single"
                collapsible
                value={openSectionId ?? ''}
                onValueChange={(value) => setOpenSectionId(value || null)}
                className="w-full space-y-4"
              >
                {sortedSections.map((section) => {
                  const index = schema.sections.indexOf(section);
                  return (
                    <SectionEditor
                      key={sectionId(section)}
                      section={section}
                      isOpen={openSectionId === sectionId(section)}
                      onChange={(s) => updateSection(index, s)}
                      onRemove={() => removeSection(index)}
                      onEditField={(fieldIndex) => setEditingField({ sectionIndex: index, fieldIndex })}
                    />
                  );
                })}

                {schema.sections.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center text-muted-foreground">
                    <p className="text-sm">Este formulario todavía no tiene secciones.</p>
                  </div>
                )}

                <Button type="button" variant="outline" className="w-full" onClick={addSection}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Agregar sección
                </Button>
              </Accordion>
            </SortableContext>
          </DndContext>
        );
      })()}

      {editingField && (() => {
        const sortedSections = [...schema.sections].sort((a, b) => a.order - b.order);
        const currentSection = schema.sections[editingField.sectionIndex];
        const currentSortedIndex = sortedSections.indexOf(currentSection);
        const field = currentSection?.fields[editingField.fieldIndex];
        if (!currentSection || !field) return null;

        const persistField = (updated: FormFieldSchema) => {
          const fields = [...currentSection.fields];
          fields[editingField.fieldIndex] = updated;
          updateSection(editingField.sectionIndex, { ...currentSection, fields });
        };

        // Anterior/siguiente recorre los campos de la sección actual y, al
        // llegar a un extremo, salta a la última/primera sección con campos
        // (en el orden visual, no en el orden de schema.sections).
        const findPrevTarget = () => {
          if (editingField.fieldIndex > 0) {
            return { sectionIndex: editingField.sectionIndex, fieldIndex: editingField.fieldIndex - 1 };
          }
          for (let s = currentSortedIndex - 1; s >= 0; s--) {
            const sec = sortedSections[s];
            if (sec.fields.length > 0) {
              return { sectionIndex: schema.sections.indexOf(sec), fieldIndex: sec.fields.length - 1 };
            }
          }
          return null;
        };

        const findNextTarget = () => {
          if (editingField.fieldIndex < currentSection.fields.length - 1) {
            return { sectionIndex: editingField.sectionIndex, fieldIndex: editingField.fieldIndex + 1 };
          }
          for (let s = currentSortedIndex + 1; s < sortedSections.length; s++) {
            const sec = sortedSections[s];
            if (sec.fields.length > 0) {
              return { sectionIndex: schema.sections.indexOf(sec), fieldIndex: 0 };
            }
          }
          return null;
        };

        const prevTarget = findPrevTarget();
        const nextTarget = findNextTarget();

        return (
          <FieldConfigPanel
            key={`${editingField.sectionIndex}-${editingField.fieldIndex}`}
            open
            initialField={field}
            usedKeys={new Set(currentSection.fields.filter((_, i) => i !== editingField.fieldIndex).map((f) => f.key))}
            onOpenChange={(open) => !open && setEditingField(null)}
            onSave={(updated) => {
              persistField(updated);
              setEditingField(null);
            }}
            canGoPrev={!!prevTarget}
            canGoNext={!!nextTarget}
            onNavigatePrev={(current) => {
              persistField(current);
              if (prevTarget) setEditingField(prevTarget);
            }}
            onNavigateNext={(current) => {
              persistField(current);
              if (nextTarget) setEditingField(nextTarget);
            }}
          />
        );
      })()}

      <FormPreview open={previewOpen} onOpenChange={setPreviewOpen} schema={schema} catalogOptions={catalogOptions} />
    </div>
  );
}
