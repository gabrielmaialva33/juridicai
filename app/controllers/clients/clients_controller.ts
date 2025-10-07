import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

import PaginateClientService from '#services/clients/paginate_client_service'
import GetClientService from '#services/clients/get_client_service'
import CreateClientService from '#services/clients/create_client_service'
import UpdateClientService from '#services/clients/update_client_service'
import DeleteClientService from '#services/clients/delete_client_service'

import {
  createClientValidator,
  updateClientValidator,
  clientFilterValidator,
} from '#validators/client'

@inject()
export default class ClientsController {
  constructor(
    private paginateClientService: PaginateClientService,
    private getClientService: GetClientService,
    private createClientService: CreateClientService,
    private updateClientService: UpdateClientService,
    private deleteClientService: DeleteClientService
  ) {}

  /**
   * GET /api/v1/clients
   * List clients with pagination and filters
   */
  async paginate({ request, response }: HttpContext) {
    const filters = await clientFilterValidator.validate(request.qs())

    const clients = await this.paginateClientService.run({
      page: filters.page || 1,
      perPage: filters.per_page || 20,
      sortBy: 'created_at',
      direction: 'desc',
      search: filters.search,
      clientType: filters.client_type,
      isActive: filters.is_active,
      state: filters.state,
      city: filters.city,
      tags: filters.tags,
      withCases: filters.with_cases || false,
      withCasesCount: filters.with_cases_count || false,
    })

    return response.json(clients)
  }

  /**
   * GET /api/v1/clients/:id
   * Get a single client with optional relationships
   */
  async get({ params, request, response }: HttpContext) {
    const clientId = +params.id
    const filters = await clientFilterValidator.validate(request.qs())

    const client = await this.getClientService.run(clientId, {
      withCases: filters.with_cases || false,
      withCasesCount: filters.with_cases_count || false,
    })

    if (!client) {
      return response.status(404).json({
        message: 'Client not found',
      })
    }

    return response.json(client)
  }

  /**
   * POST /api/v1/clients
   * Create a new client
   */
  async create({ request, response }: HttpContext) {
    const payload = await createClientValidator.validate(request.all())
    const client = await this.createClientService.run(payload)

    return response.created(client)
  }

  /**
   * PATCH /api/v1/clients/:id
   * Update an existing client
   */
  async update({ params, request, response }: HttpContext) {
    const clientId = +params.id
    const payload = await updateClientValidator.validate(request.all(), { meta: { clientId } })
    const client = await this.updateClientService.run(clientId, payload)

    return response.json(client)
  }

  /**
   * DELETE /api/v1/clients/:id
   * Soft delete (deactivate) a client
   */
  async delete({ params, response }: HttpContext) {
    const clientId = +params.id
    await this.deleteClientService.run(clientId)

    return response.noContent()
  }
}
