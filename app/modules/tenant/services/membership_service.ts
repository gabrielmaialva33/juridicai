import tenantMembershipRepository from '#modules/tenant/repositories/tenant_membership_repository'

class MembershipService {
  listUserTenants(userId: string) {
    return tenantMembershipRepository.listByUser(userId)
  }

  async assertUserBelongsToTenant(tenantId: string, userId: string) {
    return tenantMembershipRepository.findActiveMembership(tenantId, userId)
  }
}

export default new MembershipService()
