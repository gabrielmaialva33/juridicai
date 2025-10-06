import { inject } from '@adonisjs/core'
import Client from '#models/client'
import ClientsRepository from '#repositories/clients_repository'
import ConflictException from '#exceptions/conflict_exception'

interface CreateClientPayload {
  client_type: 'individual' | 'company'
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
export default class CreateClientService {
  constructor(private clientsRepository: ClientsRepository) {}

  /**
   * Create a new client
   * Validates uniqueness of CPF/CNPJ within tenant
   * Tenant_id will be set automatically by withTenantScope mixin
   */
  async run(payload: CreateClientPayload): Promise<Client> {
    // Validate client_type consistency
    if (payload.client_type === 'individual') {
      if (!payload.full_name || !payload.cpf) {
        throw new Error('Full name and CPF are required for individual clients')
      }

      // Check if CPF already exists in tenant
      const existingClient = await this.clientsRepository.findByCpf(payload.cpf)
      if (existingClient) {
        throw new ConflictException('A client with this CPF already exists')
      }
    } else if (payload.client_type === 'company') {
      if (!payload.company_name || !payload.cnpj) {
        throw new Error('Company name and CNPJ are required for company clients')
      }

      // Check if CNPJ already exists in tenant
      const existingClient = await this.clientsRepository.findByCnpj(payload.cnpj)
      if (existingClient) {
        throw new ConflictException('A client with this CNPJ already exists')
      }
    }

    // Create client (tenant_id will be set automatically)
    const client = await Client.create({
      ...payload,
      is_active: payload.is_active ?? true,
    })

    return client
  }
}
