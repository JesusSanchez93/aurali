'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, useWatch } from 'react-hook-form';
import { AlertTriangle } from 'lucide-react';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { FormInput } from '@/components/common/form/form-input';
import { FormTextarea } from '@/components/common/form/form-textarea';
import { FormSelect } from '@/components/common/form/form-select';
import Tiptap from '@/components/common/tip-tap';
import { isFieldVisible as isFieldVisibleShared } from '@/lib/forms/fieldVisibility';
import { tiptapToHTML } from '@/lib/tiptap-to-html';
import { NODE_TYPES_CONFIG, type ConfigField } from './node-config';
import type { WorkflowNode, WorkflowNodeType, WorkflowEdge } from './types';

interface NodeConfigPanelProps {
  node: WorkflowNode;
  edges?: WorkflowEdge[];
  allNodes?: WorkflowNode[];
  onUpdate: (id: string, data: Partial<WorkflowNode['data']>) => void;
  onClose: () => void;
}

const SEND_EMAIL_NODE_TYPES: WorkflowNodeType[] = ['send_email', 'send_documents'];

/** Same guard pattern as resolveBodyHtml (lib/workflow/nodeExecutors.ts) —
 *  body puede venir vacío, como string plano (legado) o como JSON de TipTap;
 *  generateHTML solo acepta lo último y lanza con cualquier otra cosa. */
function safeTiptapToHTML(body: unknown): string {
  if (!body) return '';
  if (typeof body === 'string') return body.replace(/\n/g, '<br>');
  try {
    return tiptapToHTML(body);
  } catch {
    return '';
  }
}

type FormValues = Record<string, string>;

function buildRichtextValues(node: WorkflowNode): Record<string, unknown> {
  const config = (node.data.config ?? {}) as Record<string, unknown>;
  const cfg = NODE_TYPES_CONFIG[node.data.type as WorkflowNodeType];
  const richtextKeys = cfg.configSchema.filter((f) => f.type === 'richtext').map((f) => f.key);
  return Object.fromEntries(richtextKeys.map((key) => [key, config[key] ?? null]));
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

export function NodeConfigPanel({ node, edges = [], allNodes = [], onUpdate, onClose }: NodeConfigPanelProps) {
  const t = useTranslations('settings.workflow_editor');
  const methods = useForm<FormValues>({ defaultValues: buildFormDefaults(node) });
  const { handleSubmit, reset, control } = methods;

  const [richtextValues, setRichtextValues] = useState<Record<string, unknown>>(
    () => buildRichtextValues(node),
  );
  const [boolValues, setBoolValues] = useState<Record<string, boolean>>(
    () => buildBoolValues(node),
  );

  useEffect(() => {
    reset(buildFormDefaults(node));
    setRichtextValues(buildRichtextValues(node));
    setBoolValues(buildBoolValues(node));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  const cfg = NODE_TYPES_CONFIG[node.data.type as WorkflowNodeType];

  // wait_email_reply no tiene config propia editable (ver node-config.ts) —
  // en su lugar se muestra, de solo lectura, el detalle del nodo "Enviar
  // Correo" real conectado justo antes en el grafo (no el anterior en el
  // array `nodes`, que solo sirve para los botones ‹/› de navegación).
  const isWaitEmailReply = node.data.type === 'wait_email_reply';
  const previousNode = useMemo(() => {
    if (!isWaitEmailReply) return null;
    const incomingEdge = edges.find((e) => e.target === node.id);
    if (!incomingEdge) return null;
    return allNodes.find((n) => n.id === incomingEdge.source) ?? null;
  }, [isWaitEmailReply, edges, allNodes, node.id]);
  const previousNodeIsSendEmail = !!previousNode && SEND_EMAIL_NODE_TYPES.includes(previousNode.data.type as WorkflowNodeType);

  const watchedValues = useWatch({ control });

  const isFieldVisible = useCallback(
    (field: Pick<ConfigField, 'dependsOn'>): boolean => {
      const values = { ...(watchedValues as Record<string, unknown>), ...boolValues };
      return isFieldVisibleShared(field.dependsOn, values);
    },
    [boolValues, watchedValues],
  );

  const visibleConfigFields = useMemo(
    () => cfg.configSchema.filter((field) => isFieldVisible(field)),
    [cfg.configSchema, isFieldVisible],
  );

  // Pairs a field marked `groupWithNext` with the field right after it so they
  // render side-by-side (e.g. "Vencer seguimiento después de" + its unit).
  const fieldRows = useMemo(() => {
    const rows: ConfigField[][] = [];
    for (let i = 0; i < visibleConfigFields.length; i++) {
      const field = visibleConfigFields[i];
      const next = visibleConfigFields[i + 1];
      if (field.groupWithNext && next) {
        rows.push([field, next]);
        i++;
      } else {
        rows.push([field]);
      }
    }
    return rows;
  }, [visibleConfigFields]);

  const handleRichtextChange = useCallback((key: string, v: unknown) => {
    setRichtextValues((prev) => ({ ...prev, [key]: v }));
  }, []);

  const handleSwitchChange = useCallback((key: string, checked: boolean) => {
    setBoolValues((prev) => ({ ...prev, [key]: checked }));
  }, []);

  const renderFieldControl = (field: ConfigField) => {
    switch (field.type) {
      case 'text':
        return (
          <FormInput
            control={control}
            name={field.key}
            label={field.label}
            placeholder={field.placeholder}
            required={field.required}
          />
        );
      case 'number':
        return (
          <FormInput
            control={control}
            name={field.key}
            label={field.label}
            placeholder={field.placeholder}
            required={field.required}
            type="number"
          />
        );
      case 'textarea':
        return (
          <FormTextarea
            control={control}
            name={field.key}
            label={field.label}
            placeholder={field.placeholder}
            required={field.required}
            rows={10}
          />
        );
      case 'richtext':
        return (
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
        );
      case 'select':
        return (
          <FormSelect
            control={control}
            name={field.key}
            label={field.label}
            required={field.required}
            options={field.options ?? []}
          />
        );
      case 'switch':
        return (
          <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
            <span className="text-xs font-medium">{field.label}</span>
            <Switch
              size="sm"
              checked={boolValues[field.key] ?? false}
              onCheckedChange={(checked) => handleSwitchChange(field.key, checked)}
            />
          </div>
        );
      default:
        return null;
    }
  };

  const onSubmit = (values: FormValues) => {
    const { title, ...configValues } = values;
    onUpdate(node.id, {
      title,
      config: {
        ...(node.data.config as object),
        ...configValues,
        ...richtextValues,
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
            <span className="text-xs font-medium text-muted-foreground">{t('node_id')}</span>
            <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
              {node.id}
            </code>
          </div>

          <Separator />

          {/* Title */}
          <FormInput
            control={control}
            name="title"
            label={t('node_title_label')}
            placeholder={t('node_title_placeholder')}
          />

          {/* wait_email_reply: detalle de solo lectura del nodo "Enviar Correo" anterior */}
          {isWaitEmailReply && (
            <>
              <Separator />
              {previousNodeIsSendEmail && previousNode ? (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('previous_node_section')}
                  </p>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">{t('previous_node_to')}</span>
                    <p className="text-sm">{String((previousNode.data.config as Record<string, unknown>)?.to ?? '—')}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">{t('previous_node_subject')}</span>
                    <p className="text-sm">{String((previousNode.data.config as Record<string, unknown>)?.subject ?? '—')}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">{t('previous_node_body')}</span>
                    <div
                      className="prose prose-sm max-w-none rounded-md border bg-muted/30 px-3 py-2 dark:prose-invert"
                      dangerouslySetInnerHTML={{
                        __html: safeTiptapToHTML((previousNode.data.config as Record<string, unknown>)?.body),
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 dark:border-amber-800/40 dark:bg-amber-950/30">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-[11px] leading-snug text-amber-700 dark:text-amber-300">
                    {t('previous_node_missing_warning')}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Dynamic config fields */}
          {visibleConfigFields.length > 0 && (
            <>
              <Separator />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('config_section')}
              </p>
            </>
          )}

          {fieldRows.map((row) => (
            <div
              key={row[0].key}
              className={row.length > 1 ? 'flex items-start gap-3' : undefined}
            >
              {row.map((field) => (
                <div key={field.key} className={row.length > 1 ? 'flex-1' : undefined}>
                  {renderFieldControl(field)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t p-4">
        <Button type="submit" size="sm" className="w-full">
          {t('apply_changes')}
        </Button>
      </div>
    </form>
    </Form>
  );
}
