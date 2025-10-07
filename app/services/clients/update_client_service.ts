import { inject } from '@adonisjs/core'
import Client from '#models/client'
import ClientsRepository from '#repositories/clients_repository'
import ConflictException from '#exceptions/conflict_exception'
import NotFoundException from '#exceptions/not_found_exception'

interface UpdateClientPayload {
  client_type?: 'individual' | 'company'
  full_name?: string | null
  cpf?: string | null
  company_name?: string | null
  cnpj?: string | null
  email?: string | null
  phone?: string | null
  address?: Record<string, any> | null
  tags?: string[] | null
  is_active?: boolean
  custom_fields?: Record<string, any> | null
  notes?: string | null
}

@inject()
export default class UpdateClientService {
  constructor(private clientsRepository: ClientsRepository) {}

  /**
   * Update an existing client
   * Validates uniqueness of CPF/CNPJ if changed
   */
  async run(clientId: number, payload: UpdateClientPayload): Promise<Client> {
    const client = await this.clientsRepository.findBy('id', clientId)

    if (!client) {
      throw new NotFoundException('Client not found')
    }

    // If changing CPF, check uniqueness
    if (payload.cpf && payload.cpf !== client.cpf) {
      const existingClient = await this.clientsRepository.findByCpf(payload.cpf)
      if (existingClient && existingClient.id !== clientId) {
        throw new ConflictException('A client with this CPF already exists')
      }
    }

    // If changing CNPJ, check uniqueness
    if (payload.cnpj && payload.cnpj !== client.cnpj) {
      const existingClient = await this.clientsRepository.findByCnpj(payload.cnpj)
      if (existingClient && existingClient.id !== clientId) {
        throw new ConflictException('A client with this CNPJ already exists')
      }
    }

    // Update client
    client.merge(payload)
    await client.save()

    return client
  }
}
