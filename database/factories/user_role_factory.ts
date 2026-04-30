import factory from '@adonisjs/lucid/factories'
import UserRole from '#modules/permission/models/user_role'
import { ensureRoleId, ensureTenantId, ensureUserId } from '#database/factories/factory_helpers'

export const UserRoleFactory = factory
  .define(UserRole, async () => {
    return {}
  })
  .before('create', async (_, row) => {
    await ensureTenantId(row)
    await ensureUserId(row)
    await ensureRoleId(row)
  })
  .build()
