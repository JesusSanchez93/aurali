import { JSX } from 'react';
import { useState } from 'react';
import { Control, FieldValues, Path } from 'react-hook-form';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../ui/form';
import { Button } from '../../ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { cn } from '@/lib/utils';

interface Props<T extends FieldValues> {
  control: Control<T>;
  disabled?: boolean;
  name: Path<T>;
  label: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  required?: boolean;
  options: { label: string; value: string }[];
  className?: string;
}

/** Igual que FormSelect pero con buscador (Popover + Command) — pensado para
 *  selects con muchas opciones, como los que vienen de un catálogo global
 *  (bancos, tipos de documento) en el Dynamic Form Builder. */
export function FormCombobox<T extends FieldValues>({
  control,
  disabled,
  name,
  label,
  placeholder = 'Selecciona una opción',
  searchPlaceholder = 'Buscar…',
  emptyText = 'Sin resultados.',
  required,
  options,
  className,
}: Props<T>): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      <FormField
        control={control}
        name={name}
        render={({ field, fieldState }) => {
          const selected = options.find((o) => o.value === field.value);
          return (
            <FormItem className="flex flex-col">
              <FormLabel className="text-sm font-medium">
                {label}
                {required && <span className="ml-0.5 text-red-500">*</span>}
              </FormLabel>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      disabled={disabled}
                      className={cn(
                        'w-full justify-between bg-background font-normal',
                        fieldState.error && 'border-red-500',
                        !selected && 'text-muted-foreground',
                      )}
                    >
                      <span className="truncate">{selected?.label ?? placeholder}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                      <CommandEmpty>{emptyText}</CommandEmpty>
                      <CommandGroup>
                        {options.map((option) => (
                          <CommandItem
                            key={option.value}
                            value={option.label}
                            onSelect={() => {
                              field.onChange(option.value);
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                field.value === option.value ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            {option.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          );
        }}
      />
    </div>
  );
}
