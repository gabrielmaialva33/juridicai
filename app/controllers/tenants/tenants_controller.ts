import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import CreateTenantService from '#services/tenants/create_tenant_service'
import UpdateTenantService from '#services/tenants/update_tenant_service'
import GetUserTenantsService from '#services/tenants/get_user_tenant_service'
import GetTenantService from '#services/tenants/get_tenant_service'
import TenantUsersRepository from '#repositories/tenant_users_repository'
import { TenantUserRole } from '#models/tenant_user'
import { createTenantValidator, updateTenantValidator } from '#validators/tenant'

@inject()
export default class TenantsController {
  constructor(
    private getUserTenantsService: GetUserTenantsService,
    private createTenantService: CreateTenantService,
    private updateTenantService: UpdateTenantService,
    private getTenantService: GetTenantService,
    private tenantUsersRepository: TenantUsersRepository
  ) {}
  /**
   * GET /api/v1/tenants
   * List user's tenants with pagination
   */
  async paginate({ request, response, auth }: HttpContext) {
    await auth.authenticateUsing(['jwt', 'api'])

    const page = request.input('page', 1)
    const perPage = request.input('per_page', 10)
    const sortBy = request.input('sort_by', 'created_at')
    const sortOrder = request.input('sort_order', 'desc')

    const user = (await auth.getUserOrFail()) as unknown as User
    const tenants = await this.getUserTenantsService.run(user.id, page, perPage, sortBy, sortOrder)

    return response.json(tenants)
  }

  /**
   * GET /api/v1/tenants/me
   * Get current tenant (based on X-Tenant-ID header)
   */
  async me({ response, tenant }: HttpContext) {
    return response.json(tenant)
  }

  /**
   * POST /api/v1/tenants
   * Create a new tenant
   */
  async create({ request, response, auth }: HttpContext) {
    await auth.authenticateUsing(['jwt', 'api'])

    const payload = await request.validateUsing(createTenantValidator)

    const user = (await auth.getUserOrFail()) as unknown as User
    const tenant = await this.createTenantService.run({
      ...payload,
      owner_user_id: user.id,
    })

    return response.created(tenant)
  }

  /**
   * GET /api/v1/tenants/:id
   * Show tenant details
   */
  async get({ params, response, auth }: HttpContext) {
    await auth.authenticateUsing(['jwt', 'api'])
    const tenantId = params.id

    // Check if the user is a member of this tenant
    const user = (await auth.getUserOrFail()) as unknown as User
    const membership = await this.tenantUsersRepository.findByTenantAndUser(tenantId, user.id)

    if (!membership) {
      return response.notFound({ message: 'Tenant not found' })
    }

    const tenant = await this.getTenantService.run(tenantId)

    if (!tenant) {
      return response.notFound({ message: 'Tenant not found' })
    }

    return response.json(tenant)
  }

  /**
   * PATCH /api/v1/tenants/:id
   * Update tenant
   */
  async update({ params, request, response, auth }: HttpContext) {
    await auth.authenticateUsing(['jwt', 'api'])
    const tenantId = params.id
    const payload = await request.validateUsing(updateTenantValidator)

    // Check if a user is a member and has the appropriate role
    const user = (await auth.getUserOrFail()) as unknown as User
    const membership = await this.tenantUsersRepository.findByTenantAndUser(tenantId, user.id)

    if (!membership) {
      return response.notFound({ message: 'Tenant not found' })
    }

    if (membership.role !== TenantUserRole.OWNER && membership.role !== TenantUserRole.ADMIN) {
      return response.forbidden({ message: 'Insufficient permissions to update this tenant' })
    }

    const tenant = await this.updateTenantService.run(tenantId, payload)

    return response.json(tenant)
  }

  /**
   * DELETE /api/v1/tenants/:id
   * Soft delete tenant (deactivate)
   */
  async delete({ params, response, auth }: HttpContext) {
    await auth.authenticateUsing(['jwt', 'api'])
    const tenantId = params.id

    // Check if a user is a member and has the appropriate role
    const user = (await auth.getUserOrFail()) as unknown as User
    const membership = await this.tenantUsersRepository.findByTenantAndUser(tenantId, user.id)

    if (!membership) {
      return response.notFound({ message: 'Tenant not found' })
    }

    if (membership.role !== TenantUserRole.OWNER && membership.role !== TenantUserRole.ADMIN) {
      return response.forbidden({ message: 'Insufficient permissions to delete this tenant' })
    }

    await this.updateTenantService.run(tenantId, {
      is_active: false,
      suspended_reason: 'Deleted by owner',
    })

    return response.noContent()
  }
}
