import BaseRepository from '#shared/repositories/base_repository'
import UserRole from '#modules/permission/models/user_role'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

class UserRoleRepository extends BaseRepository<typeof UserRole> {
  constructor() {
    super(UserRole)
  }

  listByUser(tenantId: string, userId: string) {
    return this.query(tenantId).where('user_id', userId)
  }

  createAssignment(
    tenantId: string,
    input: {
      userId: string
      roleId: string
    },
    trx?: TransactionClientContract
  ) {
    return UserRole.create(
      {
        tenantId,
        userId: input.userId,
        roleId: input.roleId,
      },
      clientOptions(trx)
    )
  }
}

function clientOptions(trx?: TransactionClientContract) {
  return trx ? { client: trx } : undefined
}

export default new UserRoleRepository()
