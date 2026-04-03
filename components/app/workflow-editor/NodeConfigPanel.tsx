'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { FormInput } from '@/components/common/form/form-input';
import { FormTextarea } from '@/components/common/form/form-textarea';
import { FormSelect } from '@/components/common/form/form-select';
import Tiptap from '@/components/common/tip-tap';
import { NODE_TYPES_CONFIG } from './node-config';
import type { WorkflowNode, WorkflowNodeType } from './types';

interface DocumentTemplate {
  id: string;
  name: string;
}

interface NodeConfigPanelProps {
  node: WorkflowNode;
  onUpdate: (id: string, data: Partial<WorkflowNode['data']>) => void;
  onClose: () => void;
  /**
   * Org document templates for template_multiselect fields.
   * When undefined (superadmin context) these fields are hidden entirely —
   * templates are configured per-organization, not globally.
   */
  documentTemplates?: DocumentTemplate[];
}

type FormValues = Record<string, string>;

function buildRichtextValues(node: WorkflowNode): Record<string, unknown> {
  const config = (node.data.config ?? {}) as Record<string, unknown>;
  const cfg = NODE_TYPES_CONFIG[node.data.type as WorkflowNodeType];
  const richtextKeys = cfg.configSchema.filter((f) => f.type === 'richtext').map((f) => f.key);
  return Object.fromEntries(richtextKeys.map((key) => [key, config[key] ?? null]));
}

function buildTemplateMultiValues(node: WorkflowNode): Record<string, string[]> {
  const config = (node.data.config ?? {}) as Record<string, unknown>;
  const cfg = NODE_TYPES_CONFIG[node.data.type as WorkflowNodeType];
  const multiKeys = cfg.configSchema
    .filter((f) => f.type === 'template_multiselect')
    .map((f) => f.key);
  return Object.fromEntries(
    multiKeys.map((key) => [
      key,
      Array.isArray(config[key]) ? (config[key] as string[]) : [],
    ]),
  );
}

function buildBoolValues(node: WorkflowNode): Record<string, boolean> {
  const config = (node.data.config ?? {}) as Record<string, unknown>;
  const cfg = NODE_TYPES_CONFIG[node.data.type as WorkflowNodeType];
  const switchKeys = cfg.configSchema.filter((f) => f.type === 'switch').map((f) => f.key);
  return Object.fromEntries(
    switchKeys.map((key) => [key, config[key] === true]),
  );
}

function buildFormDefaults(node: WorkflowNode): FormValues {
  const config = (node.data.config ?? {}) as Record<string, unknown>;
  return {
    title: (node.data.title as string) ?? '',
    ...Object.fromEntries(
      Object.entries(config)
        .filter(([, v]) => typeof v === 'string')
        .map(([k, v]) => [k, v as string]),
    ),
  };
}

export function NodeConfigPanel({ node, onUpdate, onClose, documentTemplates }: NodeConfigPanelProps) {
  const methods = useForm<FormValues>({ defaultValues: buildFormDefaults(node) });
  const { handleSubmit, reset, control } = methods;

  const [richtextValues, setRichtextValues] = useState<Record<string, unknown>>(
    () => buildRichtextValues(node),
  );
  const [templateMultiValues, setTemplateMultiValues] = useState<Record<string, string[]>>(
    () => buildTemplateMultiValues(node),
  );
  const [boolValues, setBoolValues] = useState<Record<string, boolean>>(
    () => buildBoolValues(node),
  );

  useEffect(() => {
    reset(buildFormDefaults(node));
    setRichtextValues(buildRichtextValues(node));
    setTemplateMultiValues(buildTemplateMultiValues(node));
    setBoolValues(buildBoolValues(node));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  const cfg = NODE_TYPES_CONFIG[node.data.type as WorkflowNodeType];

  const isFieldVisible = useCallback(
    (field: { dependsOn?: { key: string; value: boolean } }): boolean => {
      if (!field.dependsOn) return true;
      return boolValues[field.dependsOn.key] === field.dependsOn.value;
    },
    [boolValues],
  );

  const visibleConfigFields = useMemo(
    () => cfg.configSchema.filter((field) => {
      if (!isFieldVisible(field)) return false;
      if (field.type === 'template_multiselect' && documentTemplates === undefined) return false;
      return true;
    }),
    [cfg.configSchema, isFieldVisible, documentTemplates],
  );

  const toggleTemplate = useCallback((fieldKey: string, templateId: string) => {
    setTemplateMultiValues((prev) => {
      const current = prev[fieldKey] ?? [];
      const next = current.includes(templateId)
        ? current.filter((id) => id !== templateId)
        : [...current, templateId];
      return { ...prev, [fieldKey]: next };
    });
  }, []);

  const handleRichtextChange = useCallback((key: string, v: unknown) => {
    setRichtextValues((prev) => ({ ...prev, [key]: v }));
  }, []);

  const handleSwitchChange = useCallback((key: string, checked: boolean) => {
    setBoolValues((prev) => ({ ...prev, [key]: checked }));
  }, []);

  const onSubmit = (values: FormValues) => {
    const { title, ...configValues } = values;
    onUpdate(node.id, {
      title,
      config: {
        ...(node.data.config as object),
        ...configValues,
        ...richtextValues,
        ...templateMultiValues,
        ...boolValues,
      },
    });
    onClose();
  };

  return (
    <Form {...methods}>
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4 pt-0">
        <div className="flex flex-col gap-4">
          {/* Node ID (read-only) */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">ID del nodo</span>
            <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
              {node.id}
            </code>
          </div>

          <Separator />

          {/* Title */}
          <FormInput
            control={control}
            name="title"
            label="Título del nodo"
            placeholder="Nombre del nodo"
          />

          {/* Dynamic config fields */}
          {visibleConfigFields.length > 0 && (
            <>
              <Separator />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Configuración
              </p>
            </>
          )}

          {cfg.configSchema.map((field) => {
            if (!isFieldVisible(field)) return null;

            return (
              <div key={field.key}>
                {field.type === 'text' && (
                  <FormInput
                    control={control}
                    name={field.key}
                    label={field.label}
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                )}

                {field.type === 'textarea' && (
                  <FormTextarea
                    control={control}
                    name={field.key}
                    label={field.label}
                    placeholder={field.placeholder}
                    required={field.required}
                    rows={10}
                  />
                )}

                {field.type === 'richtext' && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium">
                      {field.label}
                      {field.required && <span className="ml-1 text-destructive">*</span>}
                    </span>
                    <Tiptap
                      value={richtextValues[field.key]}
                      onChange={(v) => handleRichtextChange(field.key, v)}
                    />
                  </div>
                )}

                {field.type === 'select' && (
                  <FormSelect
                    control={control}
                    name={field.key}
                    label={field.label}
                    required={field.required}
                    options={field.options ?? []}
                  />
                )}

                {field.type === 'switch' && (
                  <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
                    <span className="text-xs font-medium">{field.label}</span>
                    <Switch
                      size="sm"
                      checked={boolValues[field.key] ?? false}
                      onCheckedChange={(checked) => handleSwitchChange(field.key, checked)}
                    />
                  </div>
                )}

                {field.type === 'template_multiselect' && documentTemplates !== undefined && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium">
                      {field.label}
                      {field.required && <span className="ml-1 text-destructive">*</span>}
                    </span>
                    {documentTemplates.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        No hay plantillas de documentos creadas.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1 rounded-md border p-2">
                        {documentTemplates.map((tpl) => {
                          const selected = (templateMultiValues[field.key] ?? []).includes(tpl.id);
                          return (
                            <label
                              key={tpl.id}
                              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted"
                            >
                              <Checkbox
                                checked={selected}
                                onCheckedChange={() => toggleTemplate(field.key, tpl.id)}
                              />
                              <span className="text-xs">{tpl.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t p-4">
        <Button type="submit" size="sm" className="w-full">
          Aplicar cambios
        </Button>
      </div>
    </form>
    </Form>
  );
}
