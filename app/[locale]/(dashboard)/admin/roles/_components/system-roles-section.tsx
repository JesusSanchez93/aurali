'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { RoleEditorSheet } from '@/components/app/roles/role-editor-sheet';
import { toast } from '@/lib/toast';
import type { PermissionDef, RoleInput, RoleSummary } from '@/lib/roles/roles';
import { deleteSystemRole, saveSystemRole, setSystemRoleActive } from '../actions';

type Editor = { role: RoleSummary | null };

export function SystemRolesSection({ roles, permissions }: { roles: RoleSummary[]; permissions: PermissionDef[] }) {
  const router = useRouter();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleSummary | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSave(values: RoleInput) {
    await saveSystemRole(values);
    toast.success(values.id ? 'Rol actualizado' : 'Rol creado');
    router.refresh();
  }

  function run(action: () => Promise<void>, success: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo completar la acción');
      } finally {
        setDeleteTarget(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Roles de Aurali</h2>
          <p className="text-sm text-muted-foreground">
            Los cambios llegan de inmediato a toda organización que use el rol oficial. Las copias personalizadas no se modifican.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditor({ role: null })}>
          <Plus className="h-4 w-4" />
          Crear rol
        </Button>
      </div>

      <div className="divide-y rounded-lg border">
        {roles.map((role) => {
          const isBase = role.code !== null;
          return (
            <div key={role.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-medium${role.isActive ? '' : ' text-muted-foreground'}`}>{role.name}</span>
                  {isBase && <Badge variant="secondary" className="text-xs">Base</Badge>}
                  {!role.isActive && <Badge variant="outline" className="text-xs text-muted-foreground">Inactivo</Badge>}
                </div>
                {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
                <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    {role.permissionKeys.length} permisos
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {role.memberCount} {role.memberCount === 1 ? 'miembro' : 'miembros'} en todas las organizaciones
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {role.code !== 'admin' && (
                  <Switch
                    size="sm"
                    checked={role.isActive}
                    disabled={isPending}
                    aria-label={role.isActive ? 'Desactivar rol' : 'Activar rol'}
                    onCheckedChange={(checked) =>
                      run(() => setSystemRoleActive(role.id, checked), checked ? 'Rol activado' : 'Rol desactivado')
                    }
                  />
                )}
                <Button variant="outline" size="sm" onClick={() => setEditor({ role })}>
                  Editar
                </Button>
                {!isBase && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    disabled={isPending}
                    aria-label={`Eliminar rol ${role.name}`}
                    onClick={() => setDeleteTarget(role)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Un rol inactivo deja de ofrecerse al asignar, pero quienes ya lo tienen conservan sus permisos.
      </p>

      {editor && (
        <RoleEditorSheet
          key={editor.role?.id ?? 'create'}
          open
          onOpenChange={(open) => !open && setEditor(null)}
          title={editor.role ? `Editar ${editor.role.name}` : 'Crear rol oficial'}
          description="Rol disponible para todas las organizaciones."
          role={editor.role}
          permissions={permissions}
          lockPermissions={editor.role?.code === 'admin'}
          onSubmit={handleSave}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && run(() => deleteSystemRole(deleteTarget.id), 'Rol eliminado')}
        title="Eliminar rol oficial"
        description={
          deleteTarget?.memberCount
            ? `«${deleteTarget.name}» está asignado a ${deleteTarget.memberCount} miembro(s); no se puede eliminar mientras esté en uso. Desactívalo en su lugar.`
            : `¿Eliminar el rol oficial «${deleteTarget?.name}»? Esta acción no se puede deshacer.`
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="destructive"
      />
    </div>
  );
}
