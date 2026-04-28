import BaseRepository from '#shared/repositories/base_repository'
import TenantMembership from '#modules/tenant/models/tenant_membership'

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
}

export default new TenantMembershipRepository()
