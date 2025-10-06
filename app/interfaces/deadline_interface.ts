import LucidRepositoryInterface from '#shared/lucid/lucid_repository_interface'
import Deadline from '#models/deadline'
import { DateTime } from 'luxon'

namespace IDeadline {
  export interface Repository extends LucidRepositoryInterface<typeof Deadline> {
    /**
     * Find overdue deadlines
     */
    findOverdue(): Promise<Deadline[]>

    /**
     * Find deadlines due today
     */
    findDueToday(): Promise<Deadline[]>

    /**
     * Find upcoming deadlines within specified days
     * @param days - Number of days to look ahead
     */
    findUpcoming(days: number): Promise<Deadline[]>

    /**
     * Find deadlines for a specific case
     * @param caseId
     */
    findByCase(caseId: number): Promise<Deadline[]>

    /**
     * Find deadlines assigned to a specific user
     * @param userId
     */
    findByResponsible(userId: number): Promise<Deadline[]>

    /**
     * Find fatal deadlines approaching
     * @param days - Number of days to look ahead
     */
    findFatalApproaching(days: number): Promise<Deadline[]>

    /**
     * Find deadlines that need alert notifications
     */
    findNeedingAlerts(): Promise<Deadline[]>

    /**
     * Get deadline statistics
     * @param filters - Optional filters for statistics
     */
    getStatistics(filters?: {
      fromDate?: DateTime
      toDate?: DateTime
      responsibleId?: number
      caseId?: number
    }): Promise<{
      total: number
      pending: number
      completed: number
      overdue: number
      fatal: number
      completionRate: number
    }>
  }

  export interface CreatePayload {
    case_id: number
    responsible_id: number
    title: string
    description?: string
    deadline_date: string
    internal_deadline_date?: string
    is_fatal?: boolean
    status?: 'pending' | 'completed' | 'expired' | 'cancelled'
    alert_config?: {
      days_before?: number[]
      email_enabled?: boolean
      sms_enabled?: boolean
      push_enabled?: boolean
      recipients?: number[]
    } | null
  }

  export interface EditPayload {
    case_id?: number
    responsible_id?: number
    title?: string
    description?: string
    deadline_date?: string
    internal_deadline_date?: string
    is_fatal?: boolean
    status?: 'pending' | 'completed' | 'expired' | 'cancelled'
    alert_config?: {
      days_before?: number[]
      email_enabled?: boolean
      sms_enabled?: boolean
      push_enabled?: boolean
      recipients?: number[]
    } | null
    completed_at?: string
    completed_by?: number
    completion_notes?: string
  }

  export interface FilterPayload {
    status?: 'pending' | 'completed' | 'expired' | 'cancelled'
    case_id?: number
    responsible_id?: number
    is_fatal?: boolean
    fromDate?: string
    toDate?: string
  }
}

export default IDeadline
