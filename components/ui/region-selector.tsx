'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { State } from 'country-state-city';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

interface RegionSelectorProps {
    countryCode?: string;
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

export function RegionSelector({
    countryCode,
    value,
    onChange,
    placeholder = 'Select region',
    disabled,
}: RegionSelectorProps) {
    const [open, setOpen] = React.useState(false);

    const regions = React.useMemo(() => {
        if (!countryCode) return [];

        return State.getStatesOfCountry(countryCode).map((s) => ({
            name: s.name,
            code: s.isoCode,
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [countryCode]);

    const selectedRegion = React.useMemo(() => {
        // We find by name because the form currently stores the name
        return regions.find((r) => r.name === value);
    }, [regions, value]);

    const isDisabled = disabled || !countryCode || regions.length === 0;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    disabled={isDisabled}
                >
                    {selectedRegion ? (
                        <span className="truncate">{selectedRegion.name}</span>
                    ) : (
                        <span className="text-muted-foreground truncate">
                            {!countryCode ? 'Select a country first' : regions.length === 0 ? 'No regions available' : placeholder}
                        </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
                <Command>
                    <CommandInput placeholder="Search region..." />
                    <CommandList>
                        <CommandEmpty>No region found.</CommandEmpty>
                        <CommandGroup>
                            {regions.map((region) => (
                                <CommandItem
                                    key={region.code}
                                    value={region.name}
                                    onSelect={() => {
                                        onChange?.(region.name);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            'mr-2 h-4 w-4',
                                            value === region.name ? 'opacity-100' : 'opacity-0'
                                        )}
                                    />
                                    {region.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
