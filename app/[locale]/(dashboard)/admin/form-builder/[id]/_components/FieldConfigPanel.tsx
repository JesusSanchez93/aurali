'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Circle, Plus, Trash2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import Sheet from '@/components/common/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FORM_FIELD_TYPES_CONFIG } from '@/lib/forms/field-types-config';
import { CATALOG_OPTIONS_SOURCES } from '@/lib/forms/catalogOptions';
import { FORM_VARIABLE_OPTIONS } from '@/lib/forms/documentVariableKeys';
import type { CatalogOptionsSource, FormFieldOption, FormFieldSchema, FormFieldType } from '@/lib/forms/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialField: FormFieldSchema;
  /** Keys ya usadas por otros campos de la misma sección — se deshabilitan en el select. */
  usedKeys: Set<string>;
  onSave: (field: FormFieldSchema) => void;
  /** Flechas de navegación (campo anterior/siguiente, incluso entre secciones)
   *  — solo se muestran si se pasan estos handlers (no aplica al modo "agregar
   *  campo nuevo"). El padre decide el orden y persiste el campo actual antes
   *  de moverse, así no se pierden cambios al navegar. */
  onNavigatePrev?: (currentField: FormFieldSchema) => void;
  onNavigateNext?: (currentField: FormFieldSchema) => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
}

const VARIABLE_GROUP_LABELS = [...new Set(FORM_VARIABLE_OPTIONS.map((o) => o.groupLabel))];
const CUSTOM_KEY_SENTINEL = '__custom__';

const OPTIONS_TYPES: FormFieldType[] = ['select', 'radio', 'checkbox_group'];
const UPLOAD_TYPES: FormFieldType[] = ['file_upload', 'image_upload'];
const NO_PLACEHOLDER_TYPES: FormFieldType[] = ['switch', 'checkbox_group', 'radio', 'date', 'financial_product'];
// financial_product siempre ocupa el ancho completo (ver DynamicSectionFields) — no tiene sentido ofrecer "Mitad".
const NO_WIDTH_CONTROL_TYPES: FormFieldType[] = ['financial_product'];

/** Resuelve el ícono de lucide-react declarado en FORM_FIELD_TYPES_CONFIG por
 *  nombre (mismo patrón usado en components/app/workflow-editor). */
function getFieldTypeIcon(type: FormFieldType) {
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
  return icons[FORM_FIELD_TYPES_CONFIG[type].icon] ?? Circle;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function FieldConfigPanel({
  open,
  onOpenChange,
  initialField,
  usedKeys,
  onSave,
  onNavigatePrev,
  onNavigateNext,
  canGoPrev,
  canGoNext,
}: Props) {
  const [field, setField] = useState<FormFieldSchema>(initialField);
  const [customKey, setCustomKey] = useState(
    initialField.key.trim().length > 0 && !FORM_VARIABLE_OPTIONS.some((o) => o.key === initialField.key),
  );
  const isNew = initialField.key.trim().length === 0;
  const needsOptions = OPTIONS_TYPES.includes(field.type);
  const isUpload = UPLOAD_TYPES.includes(field.type);
  const keyIsTaken = field.key.trim().length > 0 && usedKeys.has(field.key);
  const canSave =
    field.key.trim().length > 0 &&
    !keyIsTaken &&
    (customKey || FORM_VARIABLE_OPTIONS.some((o) => o.key === field.key)) &&
    field.label.trim().length > 0;

  const updateOption = (index: number, patch: Partial<FormFieldOption>) => {
    const options = [...(field.options ?? [])];
    options[index] = { ...options[index], ...patch };
    setField({ ...field, options });
  };

  const addOption = () => setField({ ...field, options: [...(field.options ?? []), { value: '', label: '' }] });
  const removeOption = (index: number) =>
    setField({ ...field, options: (field.options ?? []).filter((_, i) => i !== index) });

  /** Al cambiar el tipo se limpia la configuración específica del tipo
   *  anterior (opciones, origen de catálogo, restricciones de archivo) para
   *  no dejar datos huérfanos que no aplican al nuevo tipo. */
  const handleTypeChange = (type: FormFieldType) => {
    setField({
      ...field,
      type,
      options: undefined,
      optionsSource: undefined,
      accept: undefined,
      maxFiles: undefined,
      width: NO_WIDTH_CONTROL_TYPES.includes(type) ? 'full' : field.width,
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-1">
          <span>{isNew ? 'Agregar campo' : 'Editar campo'}</span>
          {(onNavigatePrev || onNavigateNext) && (
            <div className="ml-1 flex items-center gap-0.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                disabled={!canGoPrev}
                onClick={() => onNavigatePrev?.(field)}
                title="Campo anterior"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                disabled={!canGoNext}
                onClick={() => onNavigateNext?.(field)}
                title="Campo siguiente"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      }
      size="lg"
      body={
        <div className="space-y-4 p-4 pt-0">
          <div className="space-y-1.5">
            <Label>Tipo de campo *</Label>
            <Select value={field.type} onValueChange={(value) => handleTypeChange(value as FormFieldType)}>
              <SelectTrigger className="h-auto min-h-9 items-start py-2 sm:h-auto sm:py-2 [&>span]:line-clamp-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FORM_FIELD_TYPES_CONFIG) as FormFieldType[]).map((type) => {
                  const Icon = getFieldTypeIcon(type);
                  return (
                    <SelectItem key={type} value={type}>
                      <span className="flex items-start gap-2">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex flex-col items-start">
                          <span>{FORM_FIELD_TYPES_CONFIG[type].label}</span>
                          <span className="text-xs text-muted-foreground">{FORM_FIELD_TYPES_CONFIG[type].description}</span>
                        </span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Etiqueta *</Label>
            <Input
              value={field.label}
              onChange={(e) => setField({ ...field, label: e.target.value })}
              placeholder="Ej. Nombre completo"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Clave (variable del documento) *</Label>
            <Select
              value={customKey ? CUSTOM_KEY_SENTINEL : field.key || undefined}
              onValueChange={(key) => {
                if (key === CUSTOM_KEY_SENTINEL) {
                  setCustomKey(true);
                  setField({ ...field, key: '' });
                  return;
                }
                const option = FORM_VARIABLE_OPTIONS.find((o) => o.key === key);
                setCustomKey(false);
                setField({
                  ...field,
                  key,
                  label: isNew && !field.label.trim() ? (option?.label ?? field.label) : field.label,
                });
              }}
            >
              <SelectTrigger className="h-auto min-h-9 items-start py-2 sm:h-auto sm:py-2 [&>span]:line-clamp-none">
                <SelectValue placeholder="Selecciona una variable" />
              </SelectTrigger>
              <SelectContent>
                {VARIABLE_GROUP_LABELS.map((groupLabel) => (
                  <SelectGroup key={groupLabel}>
                    <SelectLabel>{groupLabel}</SelectLabel>
                    {FORM_VARIABLE_OPTIONS.filter((o) => o.groupLabel === groupLabel).map((option) => (
                      <SelectItem
                        key={option.key}
                        value={option.key}
                        disabled={option.key !== initialField.key && usedKeys.has(option.key)}
                      >
                        <span className="flex flex-col items-start">
                          <span>{option.label}</span>
                          <span className="font-mono text-xs text-muted-foreground">{option.token}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                <SelectGroup>
                  <SelectLabel>Otra</SelectLabel>
                  <SelectItem value={CUSTOM_KEY_SENTINEL}>Personalizada…</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            {customKey && (
              <Input
                value={field.key}
                onChange={(e) => setField({ ...field, key: slugify(e.target.value) })}
                className="font-mono text-xs"
                placeholder="clave_personalizada"
              />
            )}

            {keyIsTaken && (
              <p className="text-xs text-destructive">Esta clave ya está en uso en otro campo de la sección.</p>
            )}
            <p className="text-xs text-muted-foreground">
              {customKey
                ? 'Identifica este campo en las respuestas guardadas. Úsala solo cuando no corresponda a ninguna variable de documento.'
                : 'Identifica este campo en las respuestas guardadas y lo asocia a la variable equivalente usada en la generación de documentos.'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Texto de ayuda</Label>
            <Textarea
              rows={2}
              value={field.helpText ?? ''}
              onChange={(e) => setField({ ...field, helpText: e.target.value })}
            />
          </div>

          {!isUpload && !NO_PLACEHOLDER_TYPES.includes(field.type) && (
            <div className="space-y-1.5">
              <Label>Placeholder</Label>
              <Input
                value={field.placeholder ?? ''}
                onChange={(e) => setField({ ...field, placeholder: e.target.value })}
              />
            </div>
          )}

          {needsOptions && (
            <div className="space-y-2">
              <Label>Origen de las opciones</Label>
              <Select
                value={field.optionsSource ?? 'manual'}
                onValueChange={(value) =>
                  setField({
                    ...field,
                    optionsSource: value === 'manual' ? undefined : (value as CatalogOptionsSource),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Escritas a mano</SelectItem>
                  {(Object.keys(CATALOG_OPTIONS_SOURCES) as CatalogOptionsSource[]).map((source) => (
                    <SelectItem key={source} value={source}>
                      {CATALOG_OPTIONS_SOURCES[source].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {field.optionsSource ? (
                <p className="text-xs text-muted-foreground">
                  Las opciones se completan automáticamente con lo que cada organización configuró en
                  Ajustes → Bancos / Ajustes → Documentos — un cliente solo ve sus propios bancos/documentos.
                  La vista previa de este builder muestra el catálogo global solo a modo de ejemplo.
                </p>
              ) : (
                <div className="space-y-2">
                  {(field.options ?? []).map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={opt.label}
                        onChange={(e) => updateOption(i, { label: e.target.value, value: opt.value || slugify(e.target.value) })}
                        placeholder="Etiqueta visible"
                      />
                      <Input
                        value={opt.value}
                        onChange={(e) => updateOption(i, { value: slugify(e.target.value) })}
                        placeholder="valor"
                        className="w-32 font-mono text-xs"
                      />
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeOption(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="outline" onClick={addOption}>
                    <Plus className="mr-1 h-3 w-3" /> Agregar opción
                  </Button>
                </div>
              )}
            </div>
          )}

          {isUpload && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipos aceptados</Label>
                <Input
                  value={field.accept ?? ''}
                  onChange={(e) => setField({ ...field, accept: e.target.value })}
                  placeholder=".pdf,image/*"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Máximo de archivos</Label>
                <Input
                  type="number"
                  min={1}
                  value={field.maxFiles ?? 1}
                  onChange={(e) => setField({ ...field, maxFiles: Number(e.target.value) || 1 })}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label className="text-sm">Requerido</Label>
            <Switch
              checked={field.validation?.required ?? false}
              onCheckedChange={(v) => setField({ ...field, validation: { ...field.validation, required: v } })}
            />
          </div>

          {!NO_WIDTH_CONTROL_TYPES.includes(field.type) && (
            <div className="space-y-1.5">
              <Label>Ancho en desktop (en mobile siempre ocupa el 100%)</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={field.width !== 'half' ? 'default' : 'outline'}
                  onClick={() => setField({ ...field, width: 'full' })}
                >
                  Completo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={field.width === 'half' ? 'default' : 'outline'}
                  onClick={() => setField({ ...field, width: 'half' })}
                >
                  Mitad
                </Button>
              </div>
            </div>
          )}
        </div>
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!canSave} onClick={() => onSave(field)}>
            Guardar campo
          </Button>
        </div>
      }
    />
  );
}
