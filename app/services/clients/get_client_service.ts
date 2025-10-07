import { inject } from '@adonisjs/core'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import Client from '#models/client'
import Case from '#models/case'
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
      await client.load('cases', (query: ModelQueryBuilderContract<typeof Case>) => {
        query.orderBy('created_at', 'desc')
      })
    }

    if (options.withCasesCount) {
      await client.loadCount('cases')
    }

    return client
  }
}
