export const PERMISSIONS = [
  'dashboard.read',
  'imports.read',
  'imports.manage',
  'precatorios.read',
  'debtors.read',
  'pii.reveal',
  'exports.manage',
  'integrations.datajud.read',
  'integrations.datajud.manage',
  'operations.read',
  'operations.manage',
  'admin.health.read',
  'admin.jobs.read',
] as const

export type PermissionSlug = (typeof PERMISSIONS)[number]

export const ROLES = [
  {
    slug: 'owner',
    name: 'Owner',
    permissions: [...PERMISSIONS],
  },
  {
    slug: 'analyst',
    name: 'Analyst',
    permissions: [
      'dashboard.read',
      'imports.read',
      'precatorios.read',
      'debtors.read',
      'integrations.datajud.read',
      'operations.read',
    ],
  },
] as const
