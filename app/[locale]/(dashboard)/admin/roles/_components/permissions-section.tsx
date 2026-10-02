'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import Sheet from '@/components/common/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { RESOURCE_LABELS } from '@/lib/auth/permission-keys';
import { toast } from '@/lib/toast';
import type { PermissionDef } from '@/lib/roles/roles';
import { setPermissionActive, updatePermission } from '../actions';

function PermissionForm({ permission, onDone }: { permission: PermissionDef; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(permission.name);
  const [description, setDescription] = useState(permission.description ?? '');
  const [isSaving, startSave] = useTransition();

  function handleSave() {
    startSave(async () => {
      try {
        await updatePermission({ id: permission.id, name, description });
        toast.success('Permiso actualizado');
        router.refresh();
        onDone();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      }
    });
  }

  return (
    <div className="space-y-4 p-4 pt-0">
      <div className="space-y-2">
        <Label>Clave</Label>
        <Input value={permission.key} disabled className="font-mono" />
        <p className="text-xs text-muted-foreground">La clave la usa el código de Aurali y no se puede cambiar.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="permission-name">Nombre</Label>
        <Input id="permission-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} disabled={isSaving} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="permission-description">Descripción</Label>
        <Textarea
          id="permission-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          rows={3}
          disabled={isSaving}
        />
      </div>
      <Button className="w-full" onClick={handleSave} disabled={isSaving || name.trim().length < 2}>
        {isSaving ? <Spinner className="h-4 w-4" /> : 'Guardar'}
      </Button>
    </div>
  );
}

export function PermissionsSection({ permissions }: { permissions: PermissionDef[] }) {
  const router = useRouter();
  const [editTarget, setEditTarget] = useState<PermissionDef | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const byResource = new Map<string, PermissionDef[]>();
    for (const p of permissions) {
      byResource.set(p.resource, [...(byResource.get(p.resource) ?? []), p]);
    }
    return [...byResource.entries()];
  }, [permissions]);

  function handleToggle(permission: PermissionDef, isActive: boolean) {
    setPendingId(permission.id);
    setPermissionActive(permission.id, isActive)
      .then(() => router.refresh())
      .catch((e) => toast.error(e instanceof Error ? e.message : 'No se pudo actualizar'))
      .finally(() => setPendingId(null));
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Catálogo de permisos</h2>
        <p className="text-sm text-muted-foreground">
          Un permiso inactivo deja de concederse a todos los roles, oficiales y personalizados, hasta que se reactive.
        </p>
      </div>

      {groups.map(([resource, items]) => (
        <div key={resource} className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">{RESOURCE_LABELS[resource] ?? resource}</h3>
          <div className="divide-y rounded-lg border">
            {items.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-medium${p.isActive ? '' : ' text-muted-foreground line-through'}`}>{p.name}</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{p.key}</code>
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    size="sm"
                    checked={p.isActive}
                    disabled={pendingId === p.id}
                    aria-label={p.isActive ? 'Desactivar permiso' : 'Activar permiso'}
                    onCheckedChange={(checked) => handleToggle(p, checked)}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setEditTarget(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Sheet
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        title="Editar permiso"
        description="Solo cambia cómo se muestra el permiso."
        body={editTarget && <PermissionForm key={editTarget.id} permission={editTarget} onDone={() => setEditTarget(null)} />}
      />
    </div>
  );
}
