import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'

import { attachRoleValidator } from '#validators/role'

import ListRolesService from '#services/roles/list_roles_service'
import SyncRolesService from '#services/roles/sync_roles_service'
import RolesRepository from '#repositories/roles_repository'
import NotFoundException from '#exceptions/not_found_exception'
import ConflictException from '#exceptions/conflict_exception'

@inject()
export default class RolesController {
  constructor(private rolesRepository: RolesRepository) {}
  async paginate({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = request.input('per_page', 10)

    const service = await app.container.make(ListRolesService)
    const roles = await service.run(page, perPage)

    return response.json(roles)
  }

  async attach({ request, response }: HttpContext) {
    const { user_id: userId, role_ids: roleIds } = await attachRoleValidator.validate(request.all())

    // Check if all roles exist
    const allRolesExist = await this.rolesRepository.allExist(roleIds)
    if (!allRolesExist) {
      throw new NotFoundException('Role not found')
    }

    // Check for existing role attachments
    const existingRoles = await db
      .from('user_roles')
      .where('user_id', userId)
      .whereIn('role_id', roleIds)

    if (existingRoles.length > 0) {
      throw new ConflictException('User already has this role')
    }

    // SyncRolesService will validate user existence via GetUserService
    const syncRolesService = await app.container.make(SyncRolesService)
    await syncRolesService.run({ userId, roleIds })

    return response.json({
      message: 'Role attached successfully',
    })
  }
}
