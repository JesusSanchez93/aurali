'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { City, State } from 'country-state-city';

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

interface CitySelectorProps {
    countryCode?: string;
    stateName?: string;
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

export function CitySelector({
    countryCode,
    stateName,
    value,
    onChange,
    placeholder = 'Select city',
    disabled,
}: CitySelectorProps) {
    const [open, setOpen] = React.useState(false);

    const cities = React.useMemo(() => {
        if (!countryCode || !stateName) return [];

        const state = State.getStatesOfCountry(countryCode).find(
            (s) => s.name === stateName
        );

        if (!state) return [];

        return City.getCitiesOfState(countryCode, state.isoCode).map((c) => ({
            name: c.name,
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [countryCode, stateName]);

    const selectedCity = React.useMemo(() => {
        return cities.find((c) => c.name === value);
    }, [cities, value]);

    const isDisabled = disabled || !countryCode || !stateName || cities.length === 0;

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
                    {selectedCity ? (
                        <span className="truncate">{selectedCity.name}</span>
                    ) : (
                        <span className="text-muted-foreground truncate">
                            {!countryCode
                                ? 'Select a country first'
                                : !stateName
                                    ? 'Select a region first'
                                    : cities.length === 0
                                        ? 'No cities available'
                                        : placeholder}
                        </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
                <Command>
                    <CommandInput placeholder="Search city..." />
                    <CommandList>
                        <CommandEmpty>No city found.</CommandEmpty>
                        <CommandGroup>
                            {cities.map((city) => (
                                <CommandItem
                                    key={city.name}
                                    value={city.name}
                                    onSelect={() => {
                                        onChange?.(city.name);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            'mr-2 h-4 w-4',
                                            value === city.name ? 'opacity-100' : 'opacity-0'
                                        )}
                                    />
                                    {city.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
