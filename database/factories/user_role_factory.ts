import factory from '@adonisjs/lucid/factories'
import UserRole from '#modules/permission/models/user_role'
import { RoleFactory } from '#database/factories/role_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import { UserFactory } from '#database/factories/user_factory'

export const UserRoleFactory = factory
  .define(UserRole, async () => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()
    const role = await RoleFactory.create()

    return {
      tenantId: tenant.id,
      userId: user.id,
      roleId: role.id,
    }
  })
  .build()
