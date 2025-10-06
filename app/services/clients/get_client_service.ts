import { inject } from '@adonisjs/core'
import Client from '#models/client'
import ClientsRepository from '#repositories/clients_repository'

interface GetClientOptions {
  withCases?: boolean
  withCasesCount?: boolean
}

@inject()
export default class GetClientService {
  constructor(private clientsRepository: ClientsRepository) {}

  /**
   * Get a single client by ID with optional relationships
   */
  async run(clientId: number, options: GetClientOptions = {}): Promise<Client | null> {
    const client = await this.clientsRepository.findBy('id', clientId)

    if (!client) {
      return null
    }

    // Load relationships if requested
    if (options.withCases) {
      await (client as any).load('cases', (query: any) => {
        query.orderBy('created_at', 'desc')
      })
    }

    if (options.withCasesCount) {
      await client.loadCount('cases')
    }

    return client
  }
}
