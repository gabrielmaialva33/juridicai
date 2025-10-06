import LucidRepositoryInterface from '#shared/lucid/lucid_repository_interface'
import Case from '#models/case'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

namespace ICase {
  export interface Repository extends LucidRepositoryInterface<typeof Case> {
    /**
     * Find a case by case number
     * @param caseNumber
     */
    findByCaseNumber(caseNumber: string): Promise<Case | null>

    /**
     * Find cases for a specific client
     * @param clientId
     */
    findByClient(clientId: number): Promise<Case[]>

    /**
     * Find urgent/high priority cases
     */
    findUrgent(): Promise<Case[]>

    /**
     * Find cases with upcoming deadlines
     * @param days - Number of days to look ahead
     */
    findWithUpcomingDeadlines(days: number): Promise<Case[]>

    /**
     * Find cases assigned to a specific lawyer
     * @param lawyerId
     */
    findByResponsible(lawyerId: number): Promise<Case[]>

    /**
     * Search cases with pagination
     * @param search - Search term to match against case number, description
     * @param page - Page number
     * @param limit - Results per page
     */
    searchCases(search: string, page: number, limit: number): Promise<ModelPaginatorContract<Case>>

    /**
     * Get case statistics
     */
    getCaseStatistics(): Promise<{
      total: number
      byStatus: Record<string, number>
      byPriority: Record<string, number>
      byType: Record<string, number>
    }>

    /**
     * Find cases requiring immediate attention
     */
    findRequiringAttention(): Promise<Case[]>
  }

  export interface CreatePayload {
    client_id: number
    case_number?: string | null
    internal_number?: string | null
    case_type?: 'civil' | 'criminal' | 'labor' | 'family' | 'tax' | 'administrative' | 'other'
    court?: string | null
    court_instance?: string | null
    status?: 'active' | 'closed' | 'archived' | 'suspended'
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    responsible_lawyer_id: number
    team_members?: number[] | null
    filed_at?: string | null
    tags?: string[] | null
    description?: string
    custom_fields?: Record<string, any> | null
    parties?: {
      autor?: { name?: string; cpf?: string; cnpj?: string; email?: string; phone?: string }
      reu?: { name?: string; cpf?: string; cnpj?: string; email?: string; phone?: string }
      outros?: Array<{ tipo?: string; name?: string; cpf?: string; cnpj?: string }>
    } | null
    case_value?: number | null
  }

  export interface EditPayload {
    client_id?: number
    case_number?: string | null
    internal_number?: string | null
    case_type?: 'civil' | 'criminal' | 'labor' | 'family' | 'tax' | 'administrative' | 'other'
    court?: string | null
    court_instance?: string | null
    status?: 'active' | 'closed' | 'archived' | 'suspended'
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    responsible_lawyer_id?: number
    team_members?: number[] | null
    filed_at?: string | null
    closed_at?: string | null
    tags?: string[] | null
    description?: string
    custom_fields?: Record<string, any> | null
    parties?: {
      autor?: { name?: string; cpf?: string; cnpj?: string; email?: string; phone?: string }
      reu?: { name?: string; cpf?: string; cnpj?: string; email?: string; phone?: string }
      outros?: Array<{ tipo?: string; name?: string; cpf?: string; cnpj?: string }>
    } | null
    case_value?: number | null
  }

  export interface FilterPayload {
    status?:
      | 'active'
      | 'closed'
      | 'archived'
      | 'suspended'
      | Array<'active' | 'closed' | 'archived' | 'suspended'>
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    case_type?: 'civil' | 'criminal' | 'labor' | 'family' | 'tax' | 'administrative' | 'other'
    court?: string
    client_id?: number
    responsible_lawyer_id?: number
    tags?: string[]
  }
}

export default ICase
