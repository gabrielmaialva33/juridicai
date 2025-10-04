import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import CreateTenantService from '#services/tenants/create_tenant_service'
import UpdateTenantService from '#services/tenants/update_tenant_service'
import ListTenantsService from '#services/tenants/list_tenant_service'
import Tenant from '#models/tenant'
import { createTenantValidator, updateTenantValidator } from '#validators/tenant_validator'

@inject()
export default class TenantsController {
  constructor(
    private createTenantService: CreateTenantService,
    private updateTenantService: UpdateTenantService,
    private listTenantsService: ListTenantsService
  ) {}

  /**
   * GET /api/v1/tenants
   * List all tenants (admin only) or user's tenants
   */
  async index({ request, response, auth }: HttpContext) {
    try {
      const filters = {
        is_active: request.input('is_active'),
        plan: request.input('plan'),
        search: request.input('search'),
      }

      const options = {
        page: request.input('page', 1),
        limit: request.input('limit', 20),
        sortBy: request.input('sort_by', 'created_at'),
        sortOrder: request.input('sort_order', 'desc'),
      }

      // If user is not admin, only show their tenants
      // For now, we'll show all tenants for simplicity (add permission check later)
      const tenants = await this.listTenantsService.execute(filters, options)

      return response.ok(tenants)
    } catch (error) {
      return response.badRequest({
        message: 'Failed to list tenants',
        error: error.message,
      })
    }
  }

  /**
   * GET /api/v1/tenants/me
   * Get current user's tenants
   */
  async me({ response, auth }: HttpContext) {
    try {
      await auth.authenticateUsing(['jwt', 'api'])
      const tenants = await this.listTenantsService.forUser(auth.user!.id)

      return response.ok({ data: tenants })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to get user tenants',
        error: error.message,
      })
    }
  }

  /**
   * POST /api/v1/tenants
   * Create a new tenant
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      await auth.authenticateUsing(['jwt', 'api'])

      const payload = await request.validateUsing(createTenantValidator)

      const tenant = await this.createTenantService.execute({
        ...payload,
        owner_user_id: auth.user!.id,
      })

      return response.created({
        message: 'Tenant created successfully',
        data: tenant,
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to create tenant',
        error: error.message,
      })
    }
  }

  /**
   * GET /api/v1/tenants/:id
   * Show tenant details
   */
  async show({ params, response }: HttpContext) {
    try {
      const tenant = await Tenant.findOrFail(params.id)

      return response.ok({ data: tenant })
    } catch (error) {
      return response.notFound({
        message: 'Tenant not found',
      })
    }
  }

  /**
   * PATCH /api/v1/tenants/:id
   * Update tenant
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateTenantValidator)

      const tenant = await this.updateTenantService.execute(params.id, payload)

      return response.ok({
        message: 'Tenant updated successfully',
        data: tenant,
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update tenant',
        error: error.message,
      })
    }
  }

  /**
   * DELETE /api/v1/tenants/:id
   * Soft delete tenant (deactivate)
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const tenant = await this.updateTenantService.execute(params.id, {
        is_active: false,
        suspended_reason: 'Deleted by owner',
      })

      return response.ok({
        message: 'Tenant deactivated successfully',
        data: tenant,
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to delete tenant',
        error: error.message,
      })
    }
  }
}
