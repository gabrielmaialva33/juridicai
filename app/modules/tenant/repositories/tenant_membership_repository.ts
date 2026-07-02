import BaseRepository from '#shared/repositories/base_repository'
import TenantMembership from '#modules/tenant/models/tenant_membership'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

class TenantMembershipRepository extends BaseRepository<typeof TenantMembership> {
  constructor() {
    super(TenantMembership)
  }

  listByUser(userId: string) {
    return TenantMembership.query().where('user_id', userId).orderBy('created_at', 'asc')
  }

  findActiveMembership(tenantId: string, userId: string) {
    return this.query(tenantId).where('user_id', userId).where('status', 'active').first()
  }

  createMembership(
    tenantId: string,
    input: {
      userId: string
      status: 'active' | 'inactive'
    },
    trx?: TransactionClientContract
  ) {
    return TenantMembership.create(
      {
        tenantId,
        userId: input.userId,
        status: input.status,
      },
      clientOptions(trx)
    )
  }
}

function clientOptions(trx?: TransactionClientContract) {
  return trx ? { client: trx } : undefined
}

export default new TenantMembershipRepository()
