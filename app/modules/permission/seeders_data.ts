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
  'market.read',
  'market.manage',
  'admin.health.read',
  'admin.jobs.read',
] as const

export type PermissionSlug = (typeof PERMISSIONS)[number]

export const ROLES = [
  {
    slug: 'owner',
    name: 'Sócio gestor',
    permissions: [...PERMISSIONS],
  },
  {
    slug: 'advocate',
    name: 'Advogado responsável',
    permissions: [
      'dashboard.read',
      'imports.read',
      'precatorios.read',
      'debtors.read',
      'pii.reveal',
      'integrations.datajud.read',
      'operations.read',
      'operations.manage',
      'market.read',
    ],
  },
  {
    slug: 'operator',
    name: 'Operador de atendimento',
    permissions: [
      'dashboard.read',
      'precatorios.read',
      'debtors.read',
      'operations.read',
      'operations.manage',
      'market.read',
    ],
  },
  {
    slug: 'analyst',
    name: 'Analista jurídico',
    permissions: [
      'dashboard.read',
      'imports.read',
      'precatorios.read',
      'debtors.read',
      'integrations.datajud.read',
      'operations.read',
      'market.read',
    ],
  },
] as const
