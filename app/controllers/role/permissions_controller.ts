import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import ListPermissionsService from '#services/permissions/list_permissions_service'
import {
  createPermissionValidator,
  syncRolePermissionsValidator,
  syncUserPermissionsValidator,
} from '#validators/permission'
import CreatePermissionService from '#services/permissions/create_permission_service'
import SyncRolePermissionsService from '#services/permissions/sync_role_permissions_service'
import SyncUserPermissionsService from '#services/permissions/sync_user_permissions_service'
import CheckUserPermissionService from '#services/permissions/check_user_permission_service'

@inject()
export default class PermissionsController {
  constructor(
    private listPermissionsService: ListPermissionsService,
    private createPermissionService: CreatePermissionService,
    private syncRolePermissionsService: SyncRolePermissionsService,
    private syncUserPermissionsService: SyncUserPermissionsService,
    private checkUserPermissionService: CheckUserPermissionService
  ) {}
  /**
   * List all permissions with pagination
   */
  async paginate({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = request.input('per_page', 10)
    const resource = request.input('resource', undefined)
    const action = request.input('action', undefined)

    const result = await this.listPermissionsService.run(page, perPage, resource, action)

    return response.json(result)
  }

  /**
   * Create a new permission
   */
  async create({ request, response }: HttpContext) {
    const data = await request.validateUsing(createPermissionValidator)

    const permission = await this.createPermissionService.run(data)

    return response.created(permission)
  }

  /**
   * Sync permissions for a role
   */
  async syncRolePermissions({ request, response }: HttpContext) {
    const { role_id: roleId, permission_ids: permissionIds } = await request.validateUsing(
      syncRolePermissionsValidator
    )

    await this.syncRolePermissionsService.run(roleId, permissionIds)

    return response.json({ message: 'Permissions synced successfully' })
  }

  /**
   * Attach permissions to a role (without removing existing ones)
   */
  async attachRolePermissions({ request, response }: HttpContext) {
    const { role_id: roleId, permission_ids: permissionIds } = await request.validateUsing(
      syncRolePermissionsValidator
    )

    await this.syncRolePermissionsService.attachPermissions(roleId, permissionIds)

    return response.json({ message: 'Permissions attached successfully' })
  }

  /**
   * Detach permissions from a role
   */
  async detachRolePermissions({ request, response }: HttpContext) {
    const { role_id: roleId, permission_ids: permissionIds } = await request.validateUsing(
      syncRolePermissionsValidator
    )

    await this.syncRolePermissionsService.detachPermissions(roleId, permissionIds)

    return response.json({ message: 'Permissions detached successfully' })
  }

  /**
   * Sync permissions for a user
   */
  async syncUserPermissions({ request, response }: HttpContext) {
    const data = await request.validateUsing(syncUserPermissionsValidator)

    await this.syncUserPermissionsService.run(data.user_id, data.permissions)

    return response.json({ message: 'User permissions synced successfully' })
  }

  /**
   * Get user permissions
   */
  async getUserPermissions({ params, response }: HttpContext) {
    const userId = params.id

    const permissions = await this.checkUserPermissionService.getUserPermissions(userId)

    return response.json({ permissions })
  }

  /**
   * Check if user has specific permissions
   */
  async checkUserPermissions({ request, params, response }: HttpContext) {
    const userId = params.id
    const permissions = request.input('permissions')
    const requireAll = request.input('require_all', false)

    const hasPermission = await this.checkUserPermissionService.run(userId, permissions, requireAll)

    return response.json({ has_permission: hasPermission })
  }
}
