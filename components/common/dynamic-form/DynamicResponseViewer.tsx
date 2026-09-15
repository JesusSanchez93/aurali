import type { ReactNode } from 'react';
import type { FormFieldSchema, FormSchema, FinancialProductValue } from '@/lib/forms/types';
import { isFieldVisible } from '@/lib/forms/fieldVisibility';
import { Separator } from '@/components/ui/separator';
import { PRODUCT_TYPE_LABELS, CARD_BRANDS, BANK_ACCOUNT_TYPES, isCardProduct } from '@/lib/forms/financialProduct';

interface Props {
  schema: FormSchema;
  responses: Record<string, Record<string, unknown>>;
}

function optionLabel(field: FormFieldSchema, value: unknown): string {
  const match = field.options?.find((o) => o.value === value);
  return match?.label ?? String(value);
}

function formatValue(field: FormFieldSchema, value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') return '—';

  switch (field.type) {
    case 'switch':
      return value ? 'Sí' : 'No';

    case 'select':
    case 'radio':
      return optionLabel(field, value);

    case 'checkbox_group':
      return Array.isArray(value) && value.length
        ? value.map((v) => optionLabel(field, v)).join(', ')
        : '—';

    case 'date': {
      const date = new Date(String(value));
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('es-CO');
    }

    case 'image_upload':
      return (
        <a href={String(value)} target="_blank" rel="noreferrer" className="block w-full max-w-[200px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={String(value)} alt={field.label} className="w-full rounded-md border object-cover hover:opacity-80 transition-opacity" />
        </a>
      );

    case 'file_upload': {
      const paths = Array.isArray(value) ? value : [value];
      return (
        <div className="flex flex-col gap-1">
          {paths.map((p, i) => (
            <a key={i} href={String(p)} target="_blank" rel="noreferrer" className="text-sm text-primary underline underline-offset-2">
              Archivo {i + 1}
            </a>
          ))}
        </div>
      );
    }

    case 'financial_product': {
      const products = Array.isArray(value) ? (value as FinancialProductValue[]) : [];
      if (!products.length) return '—';
      return (
        <div className="space-y-2">
          {products.map((p, i) => (
            <div key={i} className="rounded-md border bg-muted/50 p-2 text-sm">
              <p className="font-medium">{PRODUCT_TYPE_LABELS[p.type] ?? p.type}</p>
              <p className="text-xs text-muted-foreground">
                {isCardProduct(p.type)
                  ? CARD_BRANDS.find((b) => b.value === p.card_brand)?.label ?? p.card_brand
                  : BANK_ACCOUNT_TYPES.find((a) => a.value === p.account_type)?.label ?? p.account_type}
                {' · '}•••• {p.last_4_digits}
              </p>
            </div>
          ))}
        </div>
      );
    }

    case 'textarea':
      return <span className="whitespace-pre-wrap">{String(value)}</span>;

    default:
      return String(value);
  }
}

/** Vista de solo lectura de las respuestas de un formulario dinámico del DFB,
 *  para el panel de detalle interno del abogado — mismo vocabulario de campos
 *  que DynamicFieldRenderer, pero mostrando el valor guardado en vez de un
 *  control editable. */
export function DynamicResponseViewer({ schema, responses }: Props) {
  const sections = [...schema.sections].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {sections.map((section, index) => {
        const data = responses[section.key] ?? {};
        const visibleFields = section.fields.filter((field) => isFieldVisible(field.dependsOn, data));

        if (!visibleFields.length) return null;

        return (
          <div key={section.key}>
            {index > 0 && <Separator className="mb-6" />}
            <h4 className="text-sm font-semibold mb-3">{section.title}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visibleFields.map((field) => {
                // financial_product y textarea siempre ocupan el ancho completo
                // (igual que financial_product en DynamicSectionFields — un
                // textarea de relato largo no debe quedar a la mitad aunque el
                // builder lo haya dejado configurado como 'half'); el resto
                // respeta field.width del builder.
                const alwaysFull = field.type === 'financial_product' || field.type === 'textarea';
                const isHalf = field.width === 'half' && !alwaysFull;
                return (
                  <div key={field.key} className={`space-y-1 ${isHalf ? 'sm:col-span-1' : 'col-span-1 sm:col-span-2'}`}>
                    <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
                    <div className="text-sm">{formatValue(field, data[field.key])}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
