import factory from '@adonisjs/lucid/factories'
import RolePermission from '#modules/permission/models/role_permission'
import { PermissionFactory } from '#database/factories/permission_factory'
import { RoleFactory } from '#database/factories/role_factory'

export const RolePermissionFactory = factory
  .define(RolePermission, async () => {
    const role = await RoleFactory.create()
    const permission = await PermissionFactory.create()

    return {
      roleId: role.id,
      permissionId: permission.id,
    }
  })
  .build()
