import { inject } from '@adonisjs/core'
import env from '#start/env'
import { HttpContext } from '@adonisjs/core/http'

@inject()
export default class DatajudService {
  private baseUrl = env.get('DATAJUD_BASE_URL')
  private apiKey = env.get('DATAJUD_API_KEY')

  async searchProcess(numeroProcesso: string, tribunal: string) {
    const url = `${this.baseUrl}/api_publica_${tribunal}/_search`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `APIKey ${this.apiKey}`,
      },
      body: JSON.stringify({
        query: {
          match: {
            numeroProcesso,
          },
        },
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to fetch data from Datajud API')
    }

    return response.json()
  }
}
