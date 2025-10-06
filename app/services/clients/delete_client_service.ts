import { inject } from '@adonisjs/core'
import ClientsRepository from '#repositories/clients_repository'
import NotFoundException from '#exceptions/not_found_exception'

/**
 * Service responsible for deleting clients (soft delete)
 *
 * This service performs a soft delete by setting the `is_active` flag to false
 * instead of permanently removing the client from the database. This preserves
 * data integrity and maintains historical records.
 *
 * @example
 * ```ts
 * const deleteClientService = await container.make(DeleteClientService)
 * await deleteClientService.run(clientId)
 * ```
 */
@inject()
export default class DeleteClientService {
  constructor(private clientRepository: ClientsRepository) {}

  /**
   * Soft delete a client by setting is_active to false
   *
   * @param clientId - The ID of the client to delete
   * @throws {NotFoundException} If the client is not found
   * @returns Promise<void>
   */
  async run(clientId: number): Promise<void> {
    const client = await this.clientRepository.findBy('id', clientId)
    if (!client) {
      throw new NotFoundException('Client not found')
    }

    client.is_active = false
    await client.save()
  }
}
