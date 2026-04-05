'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  max?: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

/**
 * Currency input with es-CO formatting (thousands separators, decimal comma).
 * Formats on every keystroke; calls onChange with a raw number.
 */
export function CurrencyInput({
  value,
  onChange,
  onBlur,
  placeholder = '0',
  disabled,
  className,
  max,
}: CurrencyInputProps) {
  const [display, setDisplay] = useState<string>(() =>
    value != null ? fmt(value) : '',
  );

  return (
    <div className={cn('flex rounded-md border overflow-hidden focus-within:ring-1 focus-within:ring-ring', className)}>
      <span className="flex items-center px-3 text-sm text-muted-foreground bg-muted border-r select-none whitespace-nowrap">
        COP $
      </span>
      <Input
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        disabled={disabled}
        value={display}
        onChange={(e) => {
          // Strip thousands dots already in the display, keep only digits and one comma
          let raw = e.target.value.replace(/\./g, '').replace(/[^\d,]/g, '');

          // Allow only one comma (decimal separator in es-CO)
          const commaIdx = raw.indexOf(',');
          if (commaIdx !== -1) {
            raw = raw.slice(0, commaIdx + 1) + raw.slice(commaIdx + 1).replace(/,/g, '');
          }

          if (!raw || raw === ',') {
            setDisplay(raw);
            onChange(undefined);
            return;
          }

          const [intPart, decPart] = raw.split(',');
          const intNum = Number(intPart || '0');

          // Format integer part with thousands separators
          const formattedInt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(intNum);
          const newDisplay = decPart !== undefined ? `${formattedInt},${decPart}` : formattedInt;
          setDisplay(newDisplay);

          // Parse numeric value
          const num = parseFloat(`${intPart || '0'}${decPart !== undefined ? '.' + decPart : ''}`);
          const parsed = isNaN(num) ? undefined : (max != null ? Math.min(num, max) : num);
          onChange(parsed);
        }}
        onBlur={() => {
          if (value != null) {
            setDisplay(fmt(value));
          } else {
            setDisplay('');
          }
          onBlur?.();
        }}
        className="border-0 rounded-none focus-visible:ring-0 shadow-none text-right"
      />
    </div>
  );
}
