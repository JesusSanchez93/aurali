'use client';

import { useEffect, useState } from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { FORM_FIELD_TYPES_CONFIG } from '@/lib/forms/field-types-config';
import type { FormFieldSchema, FormSection } from '@/lib/forms/types';
import { FieldConfigPanel } from './FieldConfigPanel';

interface Props {
  section: FormSection;
  isOpen: boolean;
  onChange: (section: FormSection) => void;
  onRemove: () => void;
  /** Editar un campo EXISTENTE se maneja en el padre (FormBuilderCanvas), que
   *  tiene visibilidad de todas las secciones — necesario para las flechas de
   *  navegación entre campos/secciones dentro del panel de detalle. */
  onEditField: (fieldIndex: number) => void;
}

/** Tipo por defecto al agregar un campo nuevo — el resto de tipos se elige
 *  dentro del panel de detalle (FieldConfigPanel), no acá. */
const EMPTY_FIELD = (): FormFieldSchema => ({
  key: '',
  label: '',
  type: 'text',
  width: 'full',
  validation: {},
});

interface SortableFieldRowProps {
  field: FormFieldSchema;
  onEdit: () => void;
  onRemove: () => void;
}

/** Fila de campo arrastrable dentro de una sección — el `key` del campo (único
 *  por diseño, ya que identifica la respuesta guardada) es también su id de
 *  ordenamiento. */
function SortableFieldRow({ field, onEdit, onRemove }: SortableFieldRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.key });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm data-[dragging=true]:relative data-[dragging=true]:z-10 data-[dragging=true]:opacity-60 data-[dragging=true]:shadow-md"
      data-dragging={isDragging || undefined}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab touch-none text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
          title="Arrastrar para reordenar"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 truncate">
          <span className="font-medium">{field.label || field.key}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {FORM_FIELD_TYPES_CONFIG[field.type].label} · {field.width === 'half' ? 'Mitad' : 'Completo'}
            {field.validation?.required ? ' · Requerido' : ''}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button type="button" size="icon" variant="ghost" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

/** Un ítem del Accordion (components/ui/accordion.tsx, shadcn/Radix) y a la
 *  vez un ítem arrastrable (@dnd-kit/sortable) — el Accordion raíz y el
 *  DndContext de secciones viven en FormBuilderCanvas. */
export function SectionEditor({ section, isOpen, onChange, onRemove, onEditField }: Props) {
  const [isAddingField, setIsAddingField] = useState(false);

  const stableId = section.id ?? section.key;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stableId });

  /** Título/descripción/slug se editan localmente y solo se propagan a
   *  `schema` (y de ahí al autoguardado) 400ms después de la última tecla —
   *  evita reescribir el schema completo, y por tanto la identidad del
   *  acordeón/dnd-kit, en cada carácter tipeado. */
  const [draft, setDraft] = useState({ title: section.title, description: section.description ?? '', key: section.key });
  const debouncedDraft = useDebounce(draft, 400);

  useEffect(() => {
    if (
      debouncedDraft.title === section.title &&
      debouncedDraft.description === (section.description ?? '') &&
      debouncedDraft.key === section.key
    ) {
      return;
    }
    onChange({ ...section, title: debouncedDraft.title, description: debouncedDraft.description, key: debouncedDraft.key });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDraft]);

  const fieldSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const removeField = (index: number) => {
    onChange({ ...section, fields: section.fields.filter((_, i) => i !== index) });
  };

  const handleFieldDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = section.fields.findIndex((f) => f.key === active.id);
    const newIndex = section.fields.findIndex((f) => f.key === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onChange({ ...section, fields: arrayMove(section.fields, oldIndex, newIndex) });
  };

  const addField = (field: FormFieldSchema) => {
    onChange({ ...section, fields: [...section.fields, field] });
    setIsAddingField(false);
  };

  return (
    <AccordionItem
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      value={stableId}
      className="w-full overflow-hidden rounded-lg border bg-background data-[dragging=true]:relative data-[dragging=true]:z-10 data-[dragging=true]:opacity-60 data-[dragging=true]:shadow-lg"
      data-dragging={isDragging || undefined}
    >
      <div className="flex items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="shrink-0 cursor-grab touch-none py-4 text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
            title="Arrastrar para reordenar"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <AccordionTrigger hideChevron className="min-w-0 flex-1 py-4 hover:no-underline">
            <span className="min-w-0 flex-1 truncate text-left">{section.title || 'Sección sin título'}</span>
            <span className="shrink-0 text-xs font-normal text-muted-foreground">
              {section.fields.length} {section.fields.length === 1 ? 'campo' : 'campos'}
            </span>
          </AccordionTrigger>
        </div>
        {/* Íconos de abrir/cerrar y eliminar agrupados juntos, fijos a la
            derecha (justify-between en la fila padre). El chevron es OTRO
            trigger real de Radix (asChild evita anidar <button> dentro de
            <button>) — no solo un ícono decorativo. */}
        <div className="flex shrink-0 items-center gap-1">
          <AccordionPrimitive.Trigger asChild>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              title={isOpen ? 'Cerrar sección' : 'Abrir sección'}
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', isOpen && 'rotate-180')} />
            </button>
          </AccordionPrimitive.Trigger>
          <Button type="button" size="icon" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <AccordionContent className="border-t px-4 pt-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Título de la sección"
              className="font-medium"
            />
            <Textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Descripción (opcional)"
              rows={2}
            />
            <Input
              value={draft.key}
              onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
              placeholder="slug-de-seccion"
              className="font-mono text-xs"
            />
          </div>

          <DndContext
            id={`form-builder-fields-dnd-${section.key}`}
            sensors={fieldSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleFieldDragEnd}
          >
            <SortableContext items={section.fields.map((f) => f.key)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {section.fields.map((field, i) => (
                  <SortableFieldRow
                    key={field.key}
                    field={field}
                    onEdit={() => onEditField(i)}
                    onRemove={() => removeField(i)}
                  />
                ))}
                {section.fields.length === 0 && (
                  <p className="text-xs text-muted-foreground/70 italic">Esta sección todavía no tiene campos.</p>
                )}
              </div>
            </SortableContext>
          </DndContext>

          <div className="border-t pt-3">
            <Button type="button" size="sm" variant="outline" onClick={() => setIsAddingField(true)}>
              <Plus className="mr-1 h-3 w-3" />
              Agregar campo
            </Button>
          </div>
        </div>
      </AccordionContent>

      {isAddingField && (
        <FieldConfigPanel
          open
          initialField={EMPTY_FIELD()}
          usedKeys={new Set(section.fields.map((f) => f.key))}
          onOpenChange={(open) => !open && setIsAddingField(false)}
          onSave={addField}
        />
      )}
    </AccordionItem>
  );
}
