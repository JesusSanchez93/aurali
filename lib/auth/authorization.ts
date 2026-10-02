import { getSessionProfile, type SessionProfile } from '@/lib/auth/get-session-profile'
import type { PermissionKey } from '@/lib/auth/permission-keys'

/**
 * Autorización basada en permisos. Los permisos efectivos los calcula
 * Postgres (`my_permissions`) a partir del rol del miembro en la organización
 * actual y llegan en el perfil de sesión — nunca se derivan de datos enviados
 * por el cliente. RLS aplica las mismas reglas con `has_permission()`.
 */
export class ForbiddenError extends Error {
  constructor(message = 'No tienes permiso para realizar esta acción') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export interface AuthContext {
  profile: SessionProfile
  organizationId: string
  permissions: Set<string>
}

/** Usuario autenticado + organización actual + sus permisos en ella. */
export async function getAuthContext(): Promise<AuthContext> {
  const { profile } = await getSessionProfile()
  if (!profile) throw new ForbiddenError('No autenticado')
  if (!profile.current_organization_id) throw new ForbiddenError('Sin organización activa')

  return {
    profile,
    organizationId: profile.current_organization_id,
    permissions: new Set(profile.permissions),
  }
}

/** ¿El usuario actual tiene el permiso en su organización actual? */
export async function can(permission: PermissionKey): Promise<boolean> {
  const { profile } = await getSessionProfile()
  if (!profile) return false
  return profile.permissions.includes(permission)
}

/**
 * Exige un permiso en la organización actual. Para Server Actions, rutas API
 * y páginas de servidor. Lanza `ForbiddenError` si no se cumple.
 */
export async function requirePermission(permission: PermissionKey): Promise<AuthContext> {
  const context = await getAuthContext()
  if (!context.permissions.has(permission)) throw new ForbiddenError()
  return context
}

/** Igual que `requirePermission`, pero basta con tener uno de los permisos. */
export async function requireAnyPermission(permissions: PermissionKey[]): Promise<AuthContext> {
  const context = await getAuthContext()
  if (!permissions.some((p) => context.permissions.has(p))) throw new ForbiddenError()
  return context
}
