import permissionRepository from '#modules/permission/repositories/permission_repository'
import userRoleRepository from '#modules/permission/repositories/user_role_repository'

class PermissionService {
  listPermissions() {
    return permissionRepository.list()
  }

  listUserRoles(tenantId: string, userId: string) {
    return userRoleRepository.listByUser(tenantId, userId)
  }
}

export default new PermissionService()
