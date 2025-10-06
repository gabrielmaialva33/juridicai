import Permission from '#models/permission'
import Role from '#models/role'
import IPermission from '#interfaces/permission_interface'

/**
 * Assign permissions to a role for testing
 * @param role - The role to assign permissions to
 * @param actions - Array of permission actions
 * @param resource - The resource type (default: USERS)
 */
export async function assignPermissions(
  role: Role,
  actions: string[],
  resource: string = IPermission.Resources.USERS
) {
  const permissions = await Promise.all(
    actions.map((action) =>
      Permission.firstOrCreate(
        { resource, action },
        { name: `${resource}.${action}`, resource, action }
      )
    )
  )
  await role.related('permissions').sync(permissions.map((p) => p.id))
}
