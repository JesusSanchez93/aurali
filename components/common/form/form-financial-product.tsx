import { Trash2 } from 'lucide-react';
import { Control, FieldArrayPath, FieldValues, Path, useFieldArray, useWatch } from 'react-hook-form';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { FormField, FormItem, FormMessage } from '../../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { FormSelect } from './form-select';
import { FormOtp } from './form-otp';
import {
  BANK_ACCOUNT_TYPES,
  CARD_BRANDS,
  PRODUCT_TYPES,
  PRODUCT_TYPE_LABELS,
  isCardProduct,
} from '@/lib/forms/financialProduct';
import type { FinancialProductType } from '@/lib/forms/types';

interface Props<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/** "Producto financiero afectado" — lista repetible de productos (cuenta
 *  bancaria / tarjeta de crédito / tarjeta débito), cada uno con su submenú
 *  dependiente (tipo de cuenta o marca de tarjeta) y los últimos 4 dígitos.
 *  Mismo componente/UX que hoy usa el formulario legado de fraude bancario
 *  (BankingInformationForm.tsx), generalizado para el Dynamic Form Builder. */
export function FormFinancialProduct<T extends FieldValues>({
  control,
  name,
  label,
  required,
  disabled,
  className,
}: Props<T>) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: name as unknown as FieldArrayPath<T>,
  });
  const currentValues = (useWatch({ control, name }) as { type: FinancialProductType }[] | undefined) ?? [];

  const addedTypes = new Set(currentValues.map((p) => p?.type));
  const availableTypes = PRODUCT_TYPES.filter((t) => !addedTypes.has(t.value));

  return (
    <div className={className}>
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </Label>

        {fields.length > 0 && (
          <div className="space-y-3">
            {fields.map((field, index) => {
              const type = (currentValues[index]?.type ?? 'bank_account') as FinancialProductType;
              return (
                <div key={field.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium">{PRODUCT_TYPE_LABELS[type]}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {type === 'bank_account' && (
                        <FormSelect
                          control={control}
                          name={`${name}.${index}.account_type` as Path<T>}
                          label="Tipo"
                          options={BANK_ACCOUNT_TYPES}
                          required
                          disabled={disabled}
                          className="w-52"
                        />
                      )}
                      {isCardProduct(type) && (
                        <FormSelect
                          control={control}
                          name={`${name}.${index}.card_brand` as Path<T>}
                          label="Marca"
                          options={CARD_BRANDS}
                          required
                          disabled={disabled}
                          className="w-52"
                        />
                      )}
                      <FormOtp
                        label="Últimos 4 dígitos"
                        control={control}
                        name={`${name}.${index}.last_4_digits` as Path<T>}
                        slotClassName="h-9 w-9 text-sm"
                        required
                        disabled={disabled}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Eliminar producto"
                        disabled={disabled}
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {availableTypes.length > 0 && (
          <Select
            value=""
            disabled={disabled}
            onValueChange={(value) => append({ type: value, last_4_digits: '' } as never)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Agregar tipo de producto…" />
            </SelectTrigger>
            <SelectContent>
              {availableTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <FormField
          control={control}
          name={name}
          render={() => (
            <FormItem>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
