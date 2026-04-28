import BaseRepository from '#shared/repositories/base_repository'
import UserRole from '#modules/permission/models/user_role'

class UserRoleRepository extends BaseRepository<typeof UserRole> {
  constructor() {
    super(UserRole)
  }

  listByUser(tenantId: string, userId: string) {
    return this.query(tenantId).where('user_id', userId)
  }
}

export default new UserRoleRepository()
