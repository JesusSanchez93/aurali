'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Plus, RefreshCw, ShieldCheck, Sparkles, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { RoleEditorSheet } from '@/components/app/roles/role-editor-sheet';
import { Link } from '@/i18n/routing';
import { RESOURCE_LABELS } from '@/lib/auth/permission-keys';
import { toast } from '@/lib/toast';
import type { RoleInput, RoleSummary } from '@/lib/roles/roles';
import { acknowledgeRoleUpdate, deleteOrgRole, saveOrgRole, type OrgRolesOverview } from '../actions';

type Editor =
  | { mode: 'view'; role: RoleSummary }
  | { mode: 'edit'; role: RoleSummary }
  | { mode: 'create'; baseRoleId: string | null };

function RoleRow({ role, badges, actions }: { role: RoleSummary; badges?: React.ReactNode; actions: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{role.name}</span>
          {badges}
        </div>
        {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
        <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            {role.permissionKeys.length} permisos
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {role.memberCount} {role.memberCount === 1 ? 'miembro' : 'miembros'}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-1">{actions}</div>
    </div>
  );
}

export function RolesSection({ overview }: { overview: OrgRolesOverview }) {
  const { canCustomize, permissions, systemRoles, customRoles, grantableKeys, planName } = overview;
  const router = useRouter();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleSummary | null>(null);
  const [isPending, startTransition] = useTransition();

  const editorRole = editor && editor.mode !== 'create' ? editor.role : null;
  const sourceRole = editorRole?.sourceRoleId
    ? systemRoles.find((r) => r.id === editorRole.sourceRoleId) ?? null
    : null;
  const missingFromSource = editorRole?.updateAvailable && sourceRole
    ? permissions.filter((p) => sourceRole.permissionKeys.includes(p.key) && !editorRole.permissionKeys.includes(p.key))
    : [];

  async function handleSave(values: RoleInput) {
    await saveOrgRole(values);
    toast.success(values.id ? 'Rol actualizado' : 'Rol creado');
    router.refresh();
  }

  function handleDelete(role: RoleSummary) {
    startTransition(async () => {
      try {
        await deleteOrgRole(role.id);
        toast.success('Rol eliminado');
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo eliminar el rol');
      } finally {
        setDeleteTarget(null);
      }
    });
  }

  function handleAcknowledge(role: RoleSummary) {
    startTransition(async () => {
      try {
        await acknowledgeRoleUpdate(role.id);
        setEditor(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo actualizar');
      }
    });
  }

  return (
    <div className="space-y-8">
      {!canCustomize && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Tu plan {planName} usa los roles oficiales de Aurali</p>
              <p className="text-sm text-muted-foreground">
                Puedes asignarlos a tu equipo. Para personalizarlos o crear los tuyos necesitas el plan Profesional.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/billing">
              <Sparkles className="h-4 w-4" />
              Ver planes
            </Link>
          </Button>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Roles de Aurali</h2>
          <p className="text-sm text-muted-foreground">
            Roles oficiales. Aurali los mantiene y sus mejoras llegan automáticamente.
          </p>
        </div>
        <div className="divide-y rounded-lg border">
          {systemRoles.map((role) => (
            <RoleRow
              key={role.id}
              role={role}
              actions={
                <>
                  <Button variant="ghost" size="sm" onClick={() => setEditor({ mode: 'view', role })}>
                    Ver permisos
                  </Button>
                  {canCustomize && (
                    <Button variant="outline" size="sm" onClick={() => setEditor({ mode: 'create', baseRoleId: role.id })}>
                      Personalizar
                    </Button>
                  )}
                </>
              }
            />
          ))}
        </div>
      </div>

      {(canCustomize || customRoles.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Mis roles</h2>
              <p className="text-sm text-muted-foreground">
                {canCustomize
                  ? 'Roles propios de tu organización.'
                  : 'Siguen funcionando para quienes los tienen asignados, pero no se pueden editar en tu plan actual.'}
              </p>
            </div>
            {canCustomize && (
              <Button size="sm" onClick={() => setEditor({ mode: 'create', baseRoleId: null })}>
                <Plus className="h-4 w-4" />
                Crear rol
              </Button>
            )}
          </div>
          <div className="rounded-lg border">
            {customRoles.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Aún no has creado roles. Personaliza uno oficial o crea uno desde cero.
              </div>
            ) : (
              <div className="divide-y">
                {customRoles.map((role) => (
                  <RoleRow
                    key={role.id}
                    role={role}
                    badges={
                      <>
                        {role.sourceRoleName && (
                          <Badge variant="secondary" className="text-xs">Basado en {role.sourceRoleName}</Badge>
                        )}
                        {role.updateAvailable && (
                          <Badge variant="outline" className="gap-1 border-amber-500/50 text-xs text-amber-700 dark:text-amber-400">
                            <RefreshCw className="h-3 w-3" />
                            Actualización disponible
                          </Badge>
                        )}
                      </>
                    }
                    actions={
                      canCustomize ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setEditor({ mode: 'edit', role })}>
                            Editar
                          </Button>
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
                        </>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setEditor({ mode: 'view', role })}>
                          Ver permisos
                        </Button>
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {editor && (
        <RoleEditorSheet
          key={editor.mode === 'create' ? `create-${editor.baseRoleId ?? 'blank'}` : `${editor.mode}-${editor.role.id}`}
          open
          onOpenChange={(open) => !open && setEditor(null)}
          title={editor.mode === 'create' ? 'Crear rol' : editor.mode === 'edit' ? 'Editar rol' : editor.role.name}
          description={
            editor.mode === 'view'
              ? 'Permisos incluidos en este rol.'
              : 'Solo puedes conceder permisos que tú también tienes.'
          }
          role={editorRole}
          permissions={permissions}
          readOnly={editor.mode === 'view'}
          baseRoles={editor.mode === 'create' ? [...systemRoles, ...customRoles] : undefined}
          initialBaseRoleId={editor.mode === 'create' ? editor.baseRoleId : null}
          grantableKeys={grantableKeys}
          onSubmit={editor.mode === 'view' ? undefined : handleSave}
          notice={
            editor.mode === 'edit' && editorRole?.updateAvailable && sourceRole ? (
              <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                <p className="font-medium">Aurali actualizó el rol «{sourceRole.name}»</p>
                <p className="text-muted-foreground">
                  {missingFromSource.length > 0
                    ? `El rol oficial incluye permisos que este rol no tiene: ${missingFromSource
                        .map((p) => `${RESOURCE_LABELS[p.resource] ?? p.resource}: ${p.name}`)
                        .join(', ')}. Tus cambios no se modificaron; márcalos abajo si quieres sumarlos.`
                    : 'Tus cambios no se modificaron y este rol ya incluye todos los permisos del oficial.'}
                </p>
                <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleAcknowledge(editorRole)}>
                  Marcar como revisada
                </Button>
              </div>
            ) : undefined
          }
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title="Eliminar rol"
        description={
          deleteTarget?.memberCount
            ? `«${deleteTarget.name}» está asignado a ${deleteTarget.memberCount} miembro(s). Reasígnalos a otro rol antes de eliminarlo.`
            : `¿Eliminar el rol «${deleteTarget?.name}»? Esta acción no se puede deshacer.`
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="destructive"
      />
    </div>
  );
}
