export const PERMISSIONS = [
  'dashboard.read',
  'imports.read',
  'imports.manage',
  'precatorios.read',
  'debtors.read',
  'pii.reveal',
  'exports.manage',
  'admin.health.read',
  'admin.jobs.read',
] as const

export const ROLES = [
  {
    slug: 'owner',
    name: 'Owner',
    permissions: [...PERMISSIONS],
  },
  {
    slug: 'analyst',
    name: 'Analyst',
    permissions: ['dashboard.read', 'imports.read', 'precatorios.read', 'debtors.read'],
  },
] as const
