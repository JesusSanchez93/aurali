'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { CircleFlag } from 'react-circle-flags';
import { Country } from 'country-state-city';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

interface CountrySelectorProps {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

const PRIORITY_COUNTRIES = ['US', 'CA', 'MX', 'CO'];

export function CountrySelector({
    value,
    onChange,
    placeholder = 'Select country',
    disabled,
}: CountrySelectorProps) {
    const [open, setOpen] = React.useState(false);

    const countries = React.useMemo(() => {
        const allCountries = Country.getAllCountries();
        const formatted = allCountries.map((c) => ({
            name: c.name,
            code: c.isoCode,
        }));

        const priority = formatted
            .filter((c) => PRIORITY_COUNTRIES.includes(c.code))
            .sort((a, b) =>
                PRIORITY_COUNTRIES.indexOf(a.code) - PRIORITY_COUNTRIES.indexOf(b.code)
            );

        const rest = formatted
            .filter((c) => !PRIORITY_COUNTRIES.includes(c.code))
            .sort((a, b) => a.name.localeCompare(b.name));

        return { priority, rest };
    }, []);

    const selectedCountry = React.useMemo(() => {
        return [...countries.priority, ...countries.rest].find(
            (c) => c.code === value
        );
    }, [countries, value]);


    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    disabled={disabled}
                >
                    {selectedCountry ? (
                        <div className="flex items-center gap-2 overflow-hidden">
                            <CircleFlag countryCode={selectedCountry.code.toLowerCase()} className="h-4 w-4 shrink-0" />
                            <span className="truncate">{selectedCountry.name}</span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
                <Command>
                    <CommandInput placeholder="Search country..." />
                    <CommandList>
                        <CommandEmpty>No country found.</CommandEmpty>
                        <CommandGroup>
                            {countries.priority.map((country) => (
                                <CommandItem
                                    key={country.code}
                                    value={country.name}
                                    onSelect={() => {
                                        onChange?.(country.code);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            'mr-2 h-4 w-4',
                                            value === country.code ? 'opacity-100' : 'opacity-0'
                                        )}
                                    />
                                    <CircleFlag countryCode={country.code.toLowerCase()} className="mr-2 h-4 w-4" />
                                    {country.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup>
                            {countries.rest.map((country) => (
                                <CommandItem
                                    key={country.code}
                                    value={country.name}
                                    onSelect={() => {
                                        onChange?.(country.code);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            'mr-2 h-4 w-4',
                                            value === country.code ? 'opacity-100' : 'opacity-0'
                                        )}
                                    />
                                    <CircleFlag countryCode={country.code.toLowerCase()} className="mr-2 h-4 w-4" />
                                    {country.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
