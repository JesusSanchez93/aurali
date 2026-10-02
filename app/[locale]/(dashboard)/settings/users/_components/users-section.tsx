'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Form } from '@/components/ui/form';
import { FormInput } from '@/components/common/form/form-input';
import { FormSelect } from '@/components/common/form/form-select';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/lib/toast';
import { UserPlus, Trash2, X, Mail } from 'lucide-react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import Sheet from '@/components/common/sheet';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import {
  inviteUserToOrg, cancelInvitation, updateMemberRole, toggleMemberActive, removeMember,
} from '../actions';
import type { OrgMember, PendingInvitation } from '../actions';
import type { AssignableRole } from '../../roles/actions';

const inviteSchema = z.object({
  email: z.string().email('Email inválido').trim(),
  roleId: z.string().min(1, 'Selecciona un rol'),
});
type InviteValues = z.infer<typeof inviteSchema>;

function MemberInitials({ firstname, lastname, email }: { firstname: string | null; lastname: string | null; email: string | null }) {
  const initials = [firstname?.[0], lastname?.[0]].filter(Boolean).join('').toUpperCase() || (email?.[0] ?? '?').toUpperCase();
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {initials}
    </div>
  );
}

type Props = {
  initialMembers: OrgMember[];
  initialInvitations: PendingInvitation[];
  currentUserId: string;
  roles: AssignableRole[];
  canInvite: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function UsersSection({ initialMembers, initialInvitations, currentUserId, roles, canInvite, canUpdate, canDelete }: Props) {
  const systemRoles = roles.filter((r) => r.isSystem);
  const customRoles = roles.filter((r) => !r.isSystem);
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));
  const roleName = (roleId: string) => roles.find((r) => r.id === roleId)?.name ?? '—';
  const [members, setMembers] = useState<OrgMember[]>(initialMembers);
  const [invitations, setInvitations] = useState<PendingInvitation[]>(initialInvitations);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<OrgMember | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isInviting, startInvite] = useTransition();

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', roleId: '' },
  });

  function handleInvite(values: InviteValues) {
    startInvite(async () => {
      try {
        await inviteUserToOrg(values.email, values.roleId);
        setInvitations((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            email: values.email,
            role_name: roleName(values.roleId),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString(),
          },
        ]);
        form.reset();
        setSheetOpen(false);
        toast.success('Invitación enviada');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al enviar invitación');
      }
    });
  }

  function handleRoleChange(member: OrgMember, roleId: string) {
    if (roleId === member.role_id) return;
    setPendingId(member.id);
    updateMemberRole(member.id, roleId)
      .then(() => setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, role_id: roleId, role_name: roleName(roleId) } : m)))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Error al actualizar rol'))
      .finally(() => setPendingId(null));
  }

  function handleToggleActive(member: OrgMember) {
    setPendingId(member.id);
    toggleMemberActive(member.id, !member.active)
      .then(() => setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, active: !m.active } : m)))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Error al actualizar estado'))
      .finally(() => setPendingId(null));
  }

  function handleRemove(member: OrgMember) {
    setPendingId(member.id);
    removeMember(member.id)
      .then(() => setMembers((prev) => prev.filter((m) => m.id !== member.id)))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Error al eliminar miembro'))
      .finally(() => { setPendingId(null); setRemoveTarget(null); });
  }

  function handleCancelInvitation(invitation: PendingInvitation) {
    setPendingId(invitation.id);
    cancelInvitation(invitation.id)
      .then(() => setInvitations((prev) => prev.filter((i) => i.id !== invitation.id)))
      .catch(() => toast.error('Error al cancelar invitación'))
      .finally(() => setPendingId(null));
  }

  return (
    <div className="space-y-8">
      {/* Members */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Miembros</h2>
            <p className="text-sm text-muted-foreground">
              Usuarios registrados que pertenecen a esta organización.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{members.length}</Badge>
            {canInvite && <Sheet
              open={sheetOpen}
              onOpenChange={(open) => { setSheetOpen(open); if (!open) form.reset(); }}
              trigger={
                <Button size="sm">
                  <UserPlus className="h-4 w-4" />
                  Invitar usuario
                </Button>
              }
              title="Invitar usuario"
              description="Envía una invitación por email para que el usuario se registre y se una a tu organización."
              body={
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleInvite)} className="w-full space-y-4 p-4 pt-0">
                    <FormInput
                      control={form.control}
                      name="email"
                      label="Email"
                      placeholder="usuario@email.com"
                      required
                      disabled={isInviting}
                    />
                    <FormSelect
                      control={form.control}
                      name="roleId"
                      label="Rol"
                      placeholder="Selecciona un rol"
                      required
                      disabled={isInviting}
                      options={roleOptions}
                    />
                    <Button type="submit" className="w-full" disabled={isInviting}>
                      {isInviting ? <Spinner className="h-4 w-4" /> : 'Enviar invitación'}
                    </Button>
                  </form>
                </Form>
              }
            />}
          </div>
        </div>

        <div className="rounded-lg border">
          {members.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No hay miembros en la organización.
            </div>
          ) : (
            <div className="divide-y">
              {members.map((member) => {
                const isMe = member.user_id === currentUserId;
                const isPending = pendingId === member.id;
                const displayName = [member.profile.firstname, member.profile.lastname].filter(Boolean).join(' ') || member.profile.email || '—';

                return (
                  <div key={member.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <MemberInitials {...member.profile} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium${!member.active ? ' text-muted-foreground line-through' : ''}`}>
                            {displayName}
                          </span>
                          {isMe && <Badge variant="outline" className="text-xs">Tú</Badge>}
                          {!member.active && <Badge variant="outline" className="text-xs text-muted-foreground">Inactivo</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">{member.profile.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isPending ? (
                        <Spinner className="h-4 w-4" />
                      ) : canUpdate && !isMe ? (
                        <Select value={member.role_id} onValueChange={(value) => handleRoleChange(member, value)}>
                          <SelectTrigger className="h-8 w-44 text-xs" aria-label="Rol del miembro">
                            <SelectValue>{member.role_name}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Roles de Aurali</SelectLabel>
                              {systemRoles.map((r) => (
                                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                              ))}
                            </SelectGroup>
                            {customRoles.length > 0 && (
                              <SelectGroup>
                                <SelectLabel>Mis roles</SelectLabel>
                                {customRoles.map((r) => (
                                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                              </SelectGroup>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary" className="text-xs">{member.role_name}</Badge>
                      )}

                      {!isMe && canUpdate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground"
                          disabled={isPending}
                          onClick={() => handleToggleActive(member)}
                        >
                          {member.active ? 'Desactivar' : 'Activar'}
                        </Button>
                      )}
                      {!isMe && canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={isPending}
                          onClick={() => setRemoveTarget(member)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Invitaciones pendientes</h2>
            <p className="text-sm text-muted-foreground">
              Usuarios invitados que aún no se han registrado.
            </p>
          </div>
          <div className="rounded-lg border">
            <div className="divide-y">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{inv.email}</span>
                        <Badge variant="secondary" className="text-xs">{inv.role_name}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Expira el {new Date(inv.expires_at).toLocaleDateString('es')}
                      </span>
                    </div>
                  </div>
                  {canInvite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={pendingId === inv.id}
                      onClick={() => handleCancelInvitation(inv)}
                    >
                      {pendingId === inv.id ? <Spinner className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => removeTarget && handleRemove(removeTarget)}
        title="Eliminar miembro"
        description={`¿Estás seguro de que deseas eliminar a "${[removeTarget?.profile.firstname, removeTarget?.profile.lastname].filter(Boolean).join(' ') || removeTarget?.profile.email}" de la organización?`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="destructive"
      />
    </div>
  );
}
