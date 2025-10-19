export const DEFAULT_PERMISSIONS = [
  // Users
  { name: 'users.create', resource: 'users', action: 'create', description: 'Create users' },
  { name: 'users.read', resource: 'users', action: 'read', description: 'Read users' },
  { name: 'users.update', resource: 'users', action: 'update', description: 'Update users' },
  { name: 'users.delete', resource: 'users', action: 'delete', description: 'Delete users' },
  { name: 'users.list', resource: 'users', action: 'list', description: 'List users' },
  { name: 'users.export', resource: 'users', action: 'export', description: 'Export users' },

  // Roles
  { name: 'roles.create', resource: 'roles', action: 'create', description: 'Create roles' },
  { name: 'roles.read', resource: 'roles', action: 'read', description: 'Read roles' },
  { name: 'roles.update', resource: 'roles', action: 'update', description: 'Update roles' },
  { name: 'roles.delete', resource: 'roles', action: 'delete', description: 'Delete roles' },
  { name: 'roles.list', resource: 'roles', action: 'list', description: 'List roles' },
  { name: 'roles.assign', resource: 'roles', action: 'assign', description: 'Assign roles' },
  { name: 'roles.revoke', resource: 'roles', action: 'revoke', description: 'Revoke roles' },

  // Permissions
  {
    name: 'permissions.create',
    resource: 'permissions',
    action: 'create',
    description: 'Create permissions',
  },
  {
    name: 'permissions.read',
    resource: 'permissions',
    action: 'read',
    description: 'Read permissions',
  },
  {
    name: 'permissions.update',
    resource: 'permissions',
    action: 'update',
    description: 'Update permissions',
  },
  {
    name: 'permissions.delete',
    resource: 'permissions',
    action: 'delete',
    description: 'Delete permissions',
  },
  {
    name: 'permissions.list',
    resource: 'permissions',
    action: 'list',
    description: 'List permissions',
  },
  {
    name: 'permissions.assign',
    resource: 'permissions',
    action: 'assign',
    description: 'Assign permissions',
  },
  {
    name: 'permissions.revoke',
    resource: 'permissions',
    action: 'revoke',
    description: 'Revoke permissions',
  },

  // Files
  { name: 'files.create', resource: 'files', action: 'create', description: 'Create files' },
  { name: 'files.read', resource: 'files', action: 'read', description: 'Read files' },
  { name: 'files.delete', resource: 'files', action: 'delete', description: 'Delete files' },
  { name: 'files.list', resource: 'files', action: 'list', description: 'List files' },

  // Settings
  {
    name: 'settings.read',
    resource: 'settings',
    action: 'read',
    description: 'Read settings',
  },
  {
    name: 'settings.update',
    resource: 'settings',
    action: 'update',
    description: 'Update settings',
  },

  // Reports
  {
    name: 'reports.read',
    resource: 'reports',
    action: 'read',
    description: 'Read reports',
  },
  {
    name: 'reports.create',
    resource: 'reports',
    action: 'create',
    description: 'Create reports',
  },
  {
    name: 'reports.export',
    resource: 'reports',
    action: 'export',
    description: 'Export reports',
  },

  // Audit
  { name: 'audit.read', resource: 'audit', action: 'read', description: 'Read audit' },
  { name: 'audit.list', resource: 'audit', action: 'list', description: 'List audit' },
  { name: 'audit.export', resource: 'audit', action: 'export', description: 'Export audit' },
]

// Define which permissions each role should have
export const ROLE_PERMISSIONS = {
  root: 'ALL', // Root gets all permissions
  admin: {
    exclude: ['permissions'], // Admin gets all except permission management
  },
  user: {
    include: [
      'users.read',
      'users.update',
      'files.create',
      'files.read',
      'files.list',
      'reports.read',
    ],
  },
  guest: {
    include: ['users.read', 'files.read', 'reports.read'],
  },
  editor: {
    include: [
      'users.read',
      'files.create',
      'files.read',
      'files.update',
      'files.list',
      'reports.read',
      'reports.create',
    ],
  },
}
