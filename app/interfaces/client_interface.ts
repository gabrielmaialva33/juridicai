import LucidRepositoryInterface from '#shared/lucid/lucid_repository_interface'
import Client from '#models/client'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

namespace IClient {
  export interface Repository extends LucidRepositoryInterface<typeof Client> {
    /**
     * Find a client by CPF
     * @param cpf
     */
    findByCpf(cpf: string): Promise<Client | null>

    /**
     * Find a client by CNPJ
     * @param cnpj
     */
    findByCnpj(cnpj: string): Promise<Client | null>

    /**
     * Find a client by email
     * @param email
     */
    findByEmail(email: string): Promise<Client | null>

    /**
     * Search clients with pagination
     * @param search - Search term to match against name, CPF, CNPJ, email
     * @param page - Page number
     * @param limit - Results per page
     */
    searchClients(
      search: string,
      page: number,
      limit: number
    ): Promise<ModelPaginatorContract<Client>>

    /**
     * Find clients by tags
     * @param tags - Array of tags to filter by
     */
    findByTags(tags: string[]): Promise<Client[]>

    /**
     * Find clients by state
     * @param state - State code (e.g., 'SP', 'RJ')
     */
    findByState(state: string): Promise<Client[]>

    /**
     * Get recently created clients
     * @param days - Number of days to look back
     */
    getRecentClients(days: number): Promise<Client[]>
  }

  export interface CreatePayload {
    client_type: 'individual' | 'company'
    full_name: string
    cpf?: string
    cnpj?: string
    rg?: string
    birth_date?: string
    email?: string
    phone?: string
    address?: {
      street?: string
      number?: string
      complement?: string
      neighborhood?: string
      city?: string
      state?: string
      zip_code?: string
      country?: string
    } | null
    tags?: string[] | null
    notes?: string
    is_active?: boolean
  }

  export interface EditPayload {
    client_type?: 'individual' | 'company'
    full_name?: string
    cpf?: string
    cnpj?: string
    rg?: string
    birth_date?: string
    email?: string
    phone?: string
    address?: {
      street?: string
      number?: string
      complement?: string
      neighborhood?: string
      city?: string
      state?: string
      zip_code?: string
      country?: string
    } | null
    tags?: string[] | null
    notes?: string
    is_active?: boolean
  }

  export interface FilterPayload {
    client_type?: 'individual' | 'company'
    state?: string
    city?: string
    tags?: string[]
    is_active?: boolean
  }
}

export default IClient
