'use client';

import { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { RESOURCE_LABELS } from '@/lib/auth/permission-keys';
import { cn } from '@/lib/utils';
import type { PermissionDef } from '@/lib/roles/roles';

interface Props {
  permissions: PermissionDef[];
  value: string[];
  onChange?: (keys: string[]) => void;
  disabled?: boolean;
  /** Permisos que el usuario puede conceder; `null` = todos. */
  grantableKeys?: string[] | null;
}

export function PermissionMatrix({ permissions, value, onChange, disabled = false, grantableKeys = null }: Props) {
  const selected = useMemo(() => new Set(value), [value]);
  const grantable = useMemo(() => (grantableKeys ? new Set(grantableKeys) : null), [grantableKeys]);

  const groups = useMemo(() => {
    const byResource = new Map<string, PermissionDef[]>();
    for (const p of permissions) {
      byResource.set(p.resource, [...(byResource.get(p.resource) ?? []), p]);
    }
    return [...byResource.entries()];
  }, [permissions]);

  // Un permiso ya concedido siempre se puede quitar; uno nuevo solo se puede
  // marcar si el usuario lo tiene (RLS lo vuelve a comprobar al guardar).
  const isLocked = (key: string) => disabled || (!!grantable && !grantable.has(key) && !selected.has(key));

  function toggle(key: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(key);
    else next.delete(key);
    onChange?.([...next]);
  }

  return (
    <div className="divide-y rounded-lg border">
      {groups.map(([resource, items]) => (
        <div key={resource} className="grid gap-3 px-4 py-3 sm:grid-cols-[9rem_1fr]">
          <p className="text-sm font-medium">{RESOURCE_LABELS[resource] ?? resource}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {items.map((p) => {
              const locked = isLocked(p.key);
              return (
                <label
                  key={p.key}
                  title={p.description ?? undefined}
                  className={cn(
                    'flex items-center gap-2 text-sm',
                    locked ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer',
                  )}
                >
                  <Checkbox
                    checked={selected.has(p.key)}
                    disabled={locked}
                    onCheckedChange={(checked) => toggle(p.key, checked === true)}
                  />
                  {p.name}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
