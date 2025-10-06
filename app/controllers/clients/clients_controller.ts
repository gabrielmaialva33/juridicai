import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

import PaginateClientService from '#services/clients/paginate_client_service'
import GetClientService from '#services/clients/get_client_service'
import CreateClientService from '#services/clients/create_client_service'
import UpdateClientService from '#services/clients/update_client_service'
import DeleteClientService from '#services/clients/delete_client_service'

import { createClientValidator, updateClientValidator } from '#validators/client'

@inject()
export default class ClientsController {
  /**
   * GET /api/v1/clients
   * List clients with pagination and filters
   */
  async paginate({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = request.input('per_page', 20)
    const sortBy = request.input('sort_by', 'created_at')
    const direction = request.input('order', 'desc')
    const search = request.input('search', undefined)
    const clientType = request.input('client_type', undefined)

    // Convert boolean query params correctly (query strings are always strings)
    const isActiveParam = request.input('is_active')
    const isActive = isActiveParam !== undefined ? isActiveParam === 'true' : undefined

    const state = request.input('state', undefined)
    const city = request.input('city', undefined)
    const tags = request.input('tags', undefined)

    const withCasesParam = request.input('with_cases')
    const withCases = withCasesParam === 'true' || withCasesParam === true

    const withCasesCountParam = request.input('with_cases_count')
    const withCasesCount = withCasesCountParam === 'true' || withCasesCountParam === true

    const service = await app.container.make(PaginateClientService)
    const clients = await service.run({
      page,
      perPage,
      sortBy,
      direction,
      search,
      clientType,
      isActive,
      state,
      city,
      tags,
      withCases,
      withCasesCount,
    })

    return response.json(clients)
  }

  /**
   * GET /api/v1/clients/:id
   * Get a single client with optional relationships
   */
  async get({ params, request, response }: HttpContext) {
    const clientId = +params.id

    // Convert boolean query params correctly
    const withCasesParam = request.input('with_cases')
    const withCases = withCasesParam === 'true' || withCasesParam === true

    const withCasesCountParam = request.input('with_cases_count')
    const withCasesCount = withCasesCountParam === 'true' || withCasesCountParam === true

    const service = await app.container.make(GetClientService)
    const client = await service.run(clientId, {
      withCases,
      withCasesCount,
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

    const service = await app.container.make(CreateClientService)
    const client = await service.run(payload)

    return response.created(client)
  }

  /**
   * PATCH /api/v1/clients/:id
   * Update an existing client
   */
  async update({ params, request, response }: HttpContext) {
    const clientId = +params.id
    const payload = await updateClientValidator.validate(request.all(), { meta: { clientId } })

    const service = await app.container.make(UpdateClientService)
    const client = await service.run(clientId, payload)

    return response.json(client)
  }

  /**
   * DELETE /api/v1/clients/:id
   * Soft delete (deactivate) a client
   */
  async delete({ params, response }: HttpContext) {
    const clientId = +params.id

    const service = await app.container.make(DeleteClientService)
    await service.run(clientId)

    return response.noContent()
  }
}
