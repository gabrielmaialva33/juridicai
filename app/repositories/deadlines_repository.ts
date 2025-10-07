import { inject } from '@adonisjs/core'
import Deadline from '#models/deadline'
import IDeadline from '#interfaces/deadline_interface'
import LucidRepository from '#shared/lucid/lucid_repository'
import { DateTime } from 'luxon'

@inject()
export default class DeadlinesRepository
  extends LucidRepository<typeof Deadline>
  implements IDeadline.Repository
{
  constructor() {
    super(Deadline)
  }

  /**
   * Find overdue deadlines
   * @returns Array of overdue deadlines
   */
  async findOverdue(): Promise<Deadline[]> {
    return this.model.query().withScopes((scopes) => {
      scopes.overdue()
      scopes.withCase()
      scopes.byPriority()
    })
  }

  /**
   * Find deadlines due today
   * @returns Array of today's deadlines
   */
  async findDueToday(): Promise<Deadline[]> {
    return this.model.query().withScopes((scopes) => {
      scopes.dueToday()
      scopes.withCase()
      scopes.byPriority()
    })
  }

  /**
   * Find upcoming deadlines within specified days
   * @param days - Number of days to look ahead
   * @returns Array of upcoming deadlines
   */
  async findUpcoming(days: number): Promise<Deadline[]> {
    return this.model.query().withScopes((scopes) => {
      scopes.upcoming(days)
      scopes.withCase()
      scopes.byDeadlineOrder()
    })
  }

  /**
   * Find deadlines for a specific case
   * @param caseId - The case ID to filter by
   * @returns Array of deadlines for the case
   */
  async findByCase(caseId: number): Promise<Deadline[]> {
    return this.model.query().withScopes((scopes) => {
      scopes.forCase(caseId)
      scopes.withResponsible()
      scopes.byDeadlineOrder()
    })
  }

  /**
   * Find deadlines assigned to a specific user
   * @param userId - The user ID to filter by
   * @returns Array of deadlines assigned to the user
   */
  async findByResponsible(userId: number): Promise<Deadline[]> {
    return this.model.query().withScopes((scopes) => {
      scopes.assignedTo(userId)
      scopes.pending()
      scopes.withCase()
      scopes.byPriority()
    })
  }

  /**
   * Find fatal deadlines approaching
   * @param days - Number of days to look ahead
   * @returns Array of approaching fatal deadlines
   */
  async findFatalApproaching(days: number): Promise<Deadline[]> {
    return this.model.query().withScopes((scopes) => {
      scopes.fatal()
      scopes.upcoming(days)
      scopes.withCase()
      scopes.withResponsible()
      scopes.byDeadlineOrder()
    })
  }

  /**
   * Find deadlines that need alert notifications
   * @returns Array of deadlines needing alerts
   */
  async findNeedingAlerts(): Promise<Deadline[]> {
    return this.model.query().withScopes((scopes) => {
      scopes.needsAlert()
      scopes.withCase()
      scopes.withResponsible()
      scopes.byDeadlineOrder()
    })
  }

  /**
   * Get deadline statistics
   * @param filters - Optional filters for statistics
   * @returns Object with deadline statistics
   */
  async getStatistics(
    filters: {
      fromDate?: DateTime
      toDate?: DateTime
      responsibleId?: number
      caseId?: number
    } = {}
  ): Promise<{
    total: number
    pending: number
    completed: number
    overdue: number
    fatal: number
    completionRate: number
  }> {
    const { fromDate, toDate, responsibleId, caseId } = filters

    // Build base query
    const baseQuery = this.model.query()

    if (fromDate && toDate) {
      baseQuery.withScopes((scopes) => scopes.dueBetween(fromDate, toDate))
    }

    if (responsibleId) {
      baseQuery.withScopes((scopes) => scopes.assignedTo(responsibleId))
    }

    if (caseId) {
      baseQuery.withScopes((scopes) => scopes.forCase(caseId))
    }

    // Execute parallel queries for different statistics
    const [total, pending, completed, overdue, fatal] = await Promise.all([
      baseQuery.clone().count('* as total'),
      baseQuery
        .clone()
        .withScopes((scopes) => scopes.pending())
        .count('* as total'),
      baseQuery
        .clone()
        .withScopes((scopes) => scopes.completed())
        .count('* as total'),
      baseQuery
        .clone()
        .withScopes((scopes) => scopes.overdue())
        .count('* as total'),
      baseQuery
        .clone()
        .withScopes((scopes) => scopes.fatal())
        .count('* as total'),
    ])

    const totalCount = total[0]?.$extras.total || 0
    const completedCount = completed[0]?.$extras.total || 0

    return {
      total: totalCount,
      pending: pending[0]?.$extras.total || 0,
      completed: completedCount,
      overdue: overdue[0]?.$extras.total || 0,
      fatal: fatal[0]?.$extras.total || 0,
      completionRate: totalCount > 0 ? (completedCount / totalCount) * 100 : 0,
    }
  }
}
