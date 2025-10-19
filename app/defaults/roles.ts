import IRole from '#interfaces/role_interface'

export const DEFAULT_ROLES = [
  {
    name: 'Root',
    slug: IRole.Slugs.ROOT,
    description: 'System administrator with all permissions',
  },
  { name: 'Admin', slug: IRole.Slugs.ADMIN, description: 'Administrator with most permissions' },
  { name: 'User', slug: IRole.Slugs.USER, description: 'Standard user with basic permissions' },
  { name: 'Guest', slug: IRole.Slugs.GUEST, description: 'Guest user with read-only access' },
  {
    name: 'Editor',
    slug: IRole.Slugs.EDITOR,
    description: 'Content editor with editing permissions',
  },
]
