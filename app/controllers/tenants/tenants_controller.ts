import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import CreateTenantService from '#services/tenants/create_tenant_service'
import UpdateTenantService from '#services/tenants/update_tenant_service'
import GetUserTenantsService from '#services/tenants/get_user_tenant_service'
import Tenant from '#models/tenant'
import { createTenantValidator, updateTenantValidator } from '#validators/tenant'

export default class TenantsController {
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

    const service = await app.container.make(GetUserTenantsService)
    const tenants = await service.run(auth.user!.id, page, perPage, sortBy, sortOrder)

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

    const service = await app.container.make(CreateTenantService)
    const tenant = await service.run({
      ...payload,
      owner_user_id: auth.user!.id,
    })

    return response.created(tenant)
  }

  /**
   * GET /api/v1/tenants/:id
   * Show tenant details
   */
  async get({ params, response }: HttpContext) {
    const tenantId = params.id

    const tenant = await Tenant.findOrFail(tenantId)

    return response.json(tenant)
  }

  /**
   * PATCH /api/v1/tenants/:id
   * Update tenant
   */
  async update({ params, request, response }: HttpContext) {
    const tenantId = params.id
    const payload = await request.validateUsing(updateTenantValidator)

    const service = await app.container.make(UpdateTenantService)
    const tenant = await service.run(tenantId, payload)

    return response.json(tenant)
  }

  /**
   * DELETE /api/v1/tenants/:id
   * Soft delete tenant (deactivate)
   */
  async delete({ params, response }: HttpContext) {
    const tenantId = params.id

    const service = await app.container.make(UpdateTenantService)
    await service.run(tenantId, {
      is_active: false,
      suspended_reason: 'Deleted by owner',
    })

    return response.noContent()
  }
}
