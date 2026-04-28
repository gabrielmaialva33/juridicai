import clientErrorRepository from '#modules/client_errors/repositories/client_error_repository'
import type { HttpContext } from '@adonisjs/core/http'

export default class ClientErrorsController {
  async store({ request, response }: HttpContext) {
    await clientErrorRepository.create(request.only(['message', 'stackHash', 'payload', 'url']))
    return response.noContent()
  }
}
