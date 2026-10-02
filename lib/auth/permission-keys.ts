/**
 * Claves del catálogo `permissions` (ver migración roles_permissions).
 * Módulo sin dependencias de servidor: se puede importar desde el cliente.
 */
export const PERMISSION_KEYS = [
  'cases.view',
  'cases.create',
  'cases.update',
  'cases.delete',
  'clients.view',
  'clients.create',
  'clients.update',
  'clients.delete',
  'documents.view',
  'documents.create',
  'documents.update',
  'documents.delete',
  'documents.sign',
  'payments.view',
  'payments.manage',
  'reports.financial',
  'users.view',
  'users.create',
  'users.update',
  'users.delete',
  'roles.manage',
  'settings.manage',
  'audit.view',
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export const RESOURCE_LABELS: Record<string, string> = {
  cases: 'Procesos',
  clients: 'Clientes',
  documents: 'Documentos',
  payments: 'Pagos',
  reports: 'Reportes',
  users: 'Equipo',
  roles: 'Roles',
  settings: 'Configuración',
  audit: 'Auditoría',
}
