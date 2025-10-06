import { inject } from '@adonisjs/core'
import ClientsRepository from '#repositories/clients_repository'

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
   * @throws {Error} If the client is not found
   * @returns Promise<void>
   */
  async run(clientId: number): Promise<void> {
    await this.clientRepository.softDelete('id', clientId)
  }
}
