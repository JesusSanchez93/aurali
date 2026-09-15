import { z } from 'zod';
import type { FinancialProductType, FinancialProductValue } from './types';

/** Mismas listas de dominio que usa hoy el formulario legado de fraude bancario
 *  (BankingInformationForm.tsx) — centralizadas aquí para que el campo
 *  `financial_product` del Dynamic Form Builder tenga paridad exacta. */
export const PRODUCT_TYPES: { value: FinancialProductType; label: string }[] = [
  { value: 'bank_account', label: 'Cuenta bancaria' },
  { value: 'credit_card', label: 'Tarjeta de crédito' },
  { value: 'debit_card', label: 'Tarjeta débito' },
];

export const PRODUCT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PRODUCT_TYPES.map((t) => [t.value, t.label]),
);

const CARD_TYPES = new Set<FinancialProductType>(['credit_card', 'debit_card']);
export function isCardProduct(type: FinancialProductType): boolean {
  return CARD_TYPES.has(type);
}

export const CARD_BRANDS = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'american_express', label: 'American Express' },
  { value: 'diners_club', label: 'Diners Club' },
  { value: 'discover', label: 'Discover' },
  { value: 'other', label: 'Otra' },
];

export const BANK_ACCOUNT_TYPES = [
  { value: 'savings', label: 'Ahorro' },
  { value: 'revolving', label: 'Rotativo' },
  { value: 'free_investment', label: 'Libre inversión' },
  { value: 'express_credit', label: 'Crédito exprés' },
];

export const CARD_BRAND_LABELS: Record<string, string> = Object.fromEntries(
  CARD_BRANDS.map((b) => [b.value, b.label]),
);

export const BANK_ACCOUNT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  BANK_ACCOUNT_TYPES.map((t) => [t.value, t.label]),
);

/** Mismo join usado por el flujo legado (BankingInformationForm/actions.ts)
 *  para la variable de documento BANKING.LAST_4_DIGITS — un string legible
 *  por humanos que resume todos los productos financieros afectados. */
export function summarizeLast4Digits(products: FinancialProductValue[]): string | null {
  return (
    products
      .map((p) => {
        const detail = p.card_brand
          ? (CARD_BRAND_LABELS[p.card_brand] ?? p.card_brand)
          : p.account_type
            ? (BANK_ACCOUNT_TYPE_LABELS[p.account_type] ?? p.account_type)
            : null;
        const typeLabel = PRODUCT_TYPE_LABELS[p.type] ?? p.type;
        return `${typeLabel}${detail ? ` ${detail}` : ''} terminada en ${p.last_4_digits}`;
      })
      .join(', ') || null
  );
}

export const financialProductSchema = z
  .object({
    type: z.enum(['bank_account', 'credit_card', 'debit_card']),
    last_4_digits: z
      .string({ required_error: 'Campo requerido' })
      .length(4, 'Ingresa exactamente 4 dígitos')
      .regex(/^\d+$/, 'Solo se permiten dígitos'),
    card_brand: z.string().optional(),
    account_type: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (isCardProduct(val.type) && !val.card_brand) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecciona la marca de la tarjeta', path: ['card_brand'] });
    }
    if (val.type === 'bank_account' && !val.account_type) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecciona el tipo de cuenta', path: ['account_type'] });
    }
  });
