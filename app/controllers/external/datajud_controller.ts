import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import DatajudService from '#services/datajud/datajud_service'

@inject()
export default class DatajudController {
  constructor(private datajudService: DatajudService) {}

  async search({ request, response }: HttpContext) {
    const { numeroProcesso, tribunal } = request.only(['numeroProcesso', 'tribunal'])

    if (!numeroProcesso || !tribunal) {
      return response.badRequest('Missing numeroProcesso or tribunal')
    }

    const data = await this.datajudService.searchProcess(numeroProcesso, tribunal)

    return response.json(data)
  }
}
