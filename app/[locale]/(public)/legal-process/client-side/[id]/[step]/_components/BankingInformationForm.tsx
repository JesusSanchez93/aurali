'use client';

import { z } from 'zod';
import { useTransition } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormOtp } from '@/components/common/form/form-otp';
import { Spinner } from '@/components/ui/spinner';
import { ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import { ViewTransition } from 'react';
import { updateBankingInformationAction } from '@/app/[locale]/(public)/legal-process/client-side/[id]/[step]/actions';
import { FormSelect } from '@/components/common/form/form-select';
import { FormFileUpload } from '@/components/common/form/form-file-upload';
import { useLegalProcessBankingData, useLegalProcessId, useLegalProcessBanks } from '@/app/[locale]/(public)/legal-process/client-side/[id]/_context/LegalProcessClientSideProvider';
import { useRouter } from 'next/navigation';

const PRODUCT_TYPES = [
  { value: 'bank_account', label: 'Cuenta bancaria' },
  { value: 'credit_card', label: 'Tarjeta de crédito' },
  { value: 'debit_card', label: 'Tarjeta débito' },
] as const;

const PRODUCT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PRODUCT_TYPES.map((t) => [t.value, t.label]),
);

const CARD_TYPES = new Set(['credit_card', 'debit_card']);
function isCardProduct(type: string) {
  return CARD_TYPES.has(type);
}

const CARD_BRANDS = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'american_express', label: 'American Express' },
  { value: 'diners_club', label: 'Diners Club' },
  { value: 'discover', label: 'Discover' },
  { value: 'other', label: 'Otra' },
];

const BANK_ACCOUNT_TYPES = [
  { value: 'savings', label: 'Ahorro' },
  { value: 'revolving', label: 'Rotativo' },
  { value: 'free_investment', label: 'Libre inversión' },
  { value: 'express_credit', label: 'Crédito exprés' },
];

const productSchema = z
  .object({
    type: z.enum(['bank_account', 'credit_card', 'debit_card']),
    last_4_digits: z
      .string({ required_error: 'Required field' })
      .length(4, 'Ingresa exactamente 4 dígitos')
      .regex(/^\d+$/, 'Solo se permiten dígitos'),
    card_brand: z.string().optional(),
    account_type: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (isCardProduct(val.type) && !val.card_brand) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Selecciona la marca de la tarjeta',
        path: ['card_brand'],
      });
    }
    if (val.type === 'bank_account' && !val.account_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Selecciona el tipo de cuenta',
        path: ['account_type'],
      });
    }
  });

const formSchema = z.object({
  bank_id: z
    .string({ required_error: 'Required field' })
    .trim()
    .min(1, 'Required field'),
  products: z
    .array(productSchema)
    .min(1, 'Agrega al menos un producto financiero'),
  file_complait: z
    .boolean({ required_error: 'Required field' })
    .default(false),
  bank_request: z
    .any()
    .optional(),
  bank_response: z
    .any()
    .optional(),
  latest_account_statement: z
    .any()
    .optional()

});

type FormValues = z.infer<typeof formSchema>;

function parseInitialProducts(products: unknown): FormValues['products'] {
  if (!Array.isArray(products)) return [];
  return products
    .filter((p): p is { type: string; last_4_digits: string; card_brand?: string; account_type?: string } =>
      !!p && typeof p === 'object' && 'type' in p && 'last_4_digits' in p,
    )
    .filter((p) => p.type in PRODUCT_TYPE_LABELS)
    .map((p) => ({
      type: p.type as FormValues['products'][number]['type'],
      last_4_digits: String(p.last_4_digits),
      card_brand: p.card_brand ?? undefined,
      account_type: p.account_type ?? undefined,
    }));
}

export default function BankingInformationForm() {
  const initialData = useLegalProcessBankingData();
  const banks = useLegalProcessBanks();
  const id = useLegalProcessId();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const bankOptions = banks.map(bank => ({ label: bank.name, value: bank.id }));

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bank_id: initialData?.bank_id ?? '',
      products: parseInitialProducts(initialData?.products),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'products',
  });

  const addedTypes = new Set(form.watch('products').map((p) => p.type));
  const availableTypes = PRODUCT_TYPES.filter((t) => !addedTypes.has(t.value));

  function onSubmit(values: FormValues) {
    const formData = new FormData();
    formData.append('bank_id', values.bank_id);
    formData.append('products', JSON.stringify(values.products));

    const selectedBank = banks.find(b => b.id === values.bank_id);
    if (selectedBank) {
      formData.append('bank_name', selectedBank.name);
      formData.append('bank_slug', selectedBank.slug ?? '');
    }

    if (values.bank_request?.file instanceof File) {
      formData.append('bank_request', values.bank_request.file);
    }

    if (Array.isArray(values.bank_response)) {
      values.bank_response.forEach((item) => {
        if (item.file instanceof File) {
          formData.append('bank_response', item.file);
        }
      });
    }

    if (Array.isArray(values.latest_account_statement)) {
      values.latest_account_statement.forEach((item) => {
        if (item.file instanceof File) {
          formData.append('latest_account_statement', item.file);
        }
      });
    }

    startTransition(async () => {
      try {
        await updateBankingInformationAction(id, formData);
        router.refresh();
        router.push(`/legal-process/client-side/${id}/info-events`);
      } catch (error) {
        console.error('Error saving banking information:', error);
      }
    });
  }

  return (
    <div className="w-full max-w-screen-sm space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-6">
            <FormSelect
              control={form.control}
              name="bank_id"
              label="Banco"
              options={bankOptions}
              size='xl'
              required
            />
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Producto financiero afectado
                <span className="ml-0.5 text-red-500">*</span>
              </Label>

              {fields.length > 0 && (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{PRODUCT_TYPE_LABELS[field.type]}</p>
                        <div className="flex items-center gap-2">
                          {field.type === 'bank_account' && (
                            <FormSelect
                              control={form.control}
                              name={`products.${index}.account_type`}
                              label="Tipo"
                              options={BANK_ACCOUNT_TYPES}
                              required
                              className="w-52"
                            />
                          )}
                          {isCardProduct(field.type) && (
                            <FormSelect
                              control={form.control}
                              name={`products.${index}.card_brand`}
                              label="Marca"
                              options={CARD_BRANDS}
                              required
                              className="w-52"
                            />
                          )}
                          <FormOtp
                            label={`Últimos 4 dígitos`}
                            control={form.control}
                            name={`products.${index}.last_4_digits`}
                            slotClassName="h-9 w-9 text-sm"
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Eliminar producto"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {availableTypes.length > 0 && (
                <Select
                  value=""
                  onValueChange={(value) => append({ type: value as FormValues['products'][number]['type'], last_4_digits: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Agregar tipo de producto…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <FormField
                control={form.control}
                name="products"
                render={() => (
                  <FormItem>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormFileUpload
              control={form.control}
              name="bank_request"
              label="Solicitud a la entidad financiera"
              accept=".pdf"
              description="Sube el documento de solicitud en formato PDF."
            />
            <FormFileUpload
              control={form.control}
              name="bank_response"
              label="Respuesta de la entidad financiera"
              accept=".pdf"
              multiple={true}
              maxFiles={3}
              description="Sube hasta 3 respuestas en formato PDF."
            />
            <FormFileUpload
              control={form.control}
              name="latest_account_statement"
              label="Último extracto bancario"
              accept=".pdf"
              multiple={true}
              maxFiles={3}
              description="Sube hasta 3 respuestas en formato PDF."
            />
          </div>
          <ViewTransition name="onboarding-form-footer">
            <div className="mt-6 flex justify-between">
              <Button
                type="button"
                disabled={isPending}
                variant="outline"
                size="icon"
                className="rounded-full"
                onClick={() => router.push(`/legal-process/client-side/${id}/personal-data`)}
              >
                <ArrowLeft />
              </Button>

              <Button
                type="submit"
                disabled={isPending}
                variant="outline"
                size="icon"
                className="rounded-full"
              >
                {!isPending ? <ArrowRight /> : <Spinner />}
              </Button>
            </div>
          </ViewTransition>
        </form>
      </Form>
    </div>
  );
}
