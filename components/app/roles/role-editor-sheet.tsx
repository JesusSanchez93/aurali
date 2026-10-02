'use client';

import { useState, useTransition, type ReactNode } from 'react';
import Sheet from '@/components/common/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/lib/toast';
import type { PermissionDef, RoleInput, RoleSummary } from '@/lib/roles/roles';
import { PermissionMatrix } from './permission-matrix';

const NO_BASE = 'none';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Rol que se edita o se muestra; `null` al crear. */
  role: RoleSummary | null;
  permissions: PermissionDef[];
  /** Solo lectura: muestra los permisos sin permitir cambios. */
  readOnly?: boolean;
  /** Los permisos no se pueden cambiar (rol Administrador), el resto sí. */
  lockPermissions?: boolean;
  /** Al crear: roles que se pueden usar como punto de partida. */
  baseRoles?: RoleSummary[];
  initialBaseRoleId?: string | null;
  grantableKeys?: string[] | null;
  notice?: ReactNode;
  onSubmit?: (values: RoleInput) => Promise<void>;
}

/**
 * Editor de un rol (nombre, descripción, permisos). El padre debe remontarlo
 * con `key` al cambiar de rol para reiniciar el estado.
 */
export function RoleEditorSheet({
  open,
  onOpenChange,
  title,
  description,
  role,
  permissions,
  readOnly = false,
  lockPermissions = false,
  baseRoles,
  initialBaseRoleId = null,
  grantableKeys = null,
  notice,
  onSubmit,
}: Props) {
  const initialBase = baseRoles?.find((r) => r.id === initialBaseRoleId) ?? null;
  const [name, setName] = useState(role?.name ?? '');
  const [roleDescription, setRoleDescription] = useState(role?.description ?? '');
  const [baseRoleId, setBaseRoleId] = useState<string | null>(initialBase?.id ?? null);
  const [keys, setKeys] = useState<string[]>(role?.permissionKeys ?? initialBase?.permissionKeys ?? []);
  const [isSaving, startSave] = useTransition();

  const isCreating = !role;

  function handleBaseChange(value: string) {
    const base = baseRoles?.find((r) => r.id === value) ?? null;
    setBaseRoleId(base?.id ?? null);
    const baseKeys = base?.permissionKeys ?? [];
    // No se precargan permisos que el usuario no podría conceder.
    setKeys(grantableKeys ? baseKeys.filter((k) => grantableKeys.includes(k)) : baseKeys);
  }

  function handleSave() {
    if (!onSubmit) return;
    if (name.trim().length < 2) {
      toast.error('El nombre es requerido');
      return;
    }
    startSave(async () => {
      try {
        await onSubmit({
          id: role?.id ?? null,
          name: name.trim(),
          description: roleDescription.trim() || null,
          sourceRoleId: isCreating ? baseRoleId : role.sourceRoleId,
          permissionKeys: keys,
        });
        onOpenChange(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo guardar el rol');
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="xl"
      stickyHeader
      stickyFooter
      body={
        <div className="space-y-5 p-4 pt-0">
          {notice}

          <div className="space-y-2">
            <Label htmlFor="role-name">Nombre</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Paralegal"
              maxLength={60}
              disabled={readOnly || isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-description">Descripción</Label>
            <Textarea
              id="role-description"
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
              placeholder="Para qué sirve este rol"
              maxLength={200}
              rows={2}
              disabled={readOnly || isSaving}
            />
          </div>

          {isCreating && baseRoles && (
            <div className="space-y-2">
              <Label>Basado en</Label>
              <Select value={baseRoleId ?? NO_BASE} onValueChange={handleBaseChange} disabled={isSaving}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BASE}>Sin rol (empezar vacío)</SelectItem>
                  {baseRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Permisos</Label>
            <PermissionMatrix
              permissions={permissions}
              value={keys}
              onChange={setKeys}
              disabled={readOnly || lockPermissions || isSaving}
              grantableKeys={grantableKeys}
            />
            {lockPermissions && !readOnly && (
              <p className="text-xs text-muted-foreground">
                El rol Administrador siempre conserva todos los permisos.
              </p>
            )}
          </div>
        </div>
      }
      footer={
        readOnly ? undefined : (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Spinner className="h-4 w-4" /> : 'Guardar'}
            </Button>
          </div>
        )
      }
    />
  );
}
