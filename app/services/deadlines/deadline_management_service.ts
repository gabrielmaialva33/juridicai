import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import Deadline from '#models/deadline'
import DeadlinesRepository from '#repositories/deadlines_repository'

interface DeadlineFilters {
  status?: 'pending' | 'completed' | 'expired' | 'cancelled'
  caseId?: number
  responsibleId?: number
  isFatal?: boolean
  search?: string
  fromDate?: DateTime
  toDate?: DateTime
}

@inject()
export default class DeadlineManagementService {
  constructor(private deadlinesRepository: DeadlinesRepository) {}

  /**
   * Get deadlines dashboard with categorized deadlines
   * Returns overdue, today, upcoming, and completed deadlines
   *
   * @param responsibleId - Optional filter by responsible user
   * @returns Categorized deadlines for dashboard view
   */
  async getDashboard(responsibleId?: number) {
    const baseQuery = Deadline.query()

    // Build queries for each category
    const overdueQuery = baseQuery.clone()
    const todayQuery = baseQuery.clone()
    const upcomingQuery = baseQuery.clone()
    const completedQuery = baseQuery.clone()

    // Apply responsible filter if provided
    if (responsibleId) {
      ;[overdueQuery, todayQuery, upcomingQuery, completedQuery].forEach((query) => {
        query.withScopes((scopes) => scopes.assignedTo(responsibleId))
      })
    }

    // Execute parallel queries for performance
    const [overdue, today, upcoming, completed] = await Promise.all([
      // Overdue deadlines
      overdueQuery
        .withScopes((scopes) => {
          scopes.overdue()
          scopes.withCase()
          scopes.byPriority()
        })
        .limit(10)
        .exec(),

      // Today's deadlines
      todayQuery
        .withScopes((scopes) => {
          scopes.dueToday()
          scopes.withCase()
          scopes.byPriority()
        })
        .exec(),

      // Upcoming deadlines (next 7 days)
      upcomingQuery
        .withScopes((scopes) => {
          scopes.upcoming(7)
          scopes.withCase()
          scopes.byDeadlineOrder()
        })
        .limit(20)
        .exec(),

      // Recently completed deadlines
      completedQuery
        .withScopes((scopes) => {
          scopes.recentlyCompleted(7)
          scopes.withCase()
          scopes.newest()
        })
        .limit(10)
        .exec(),
    ])

    return {
      overdue,
      today,
      upcoming,
      completed,
      stats: {
        overdueCount: overdue.length,
        todayCount: today.length,
        upcomingCount: upcoming.length,
        completedCount: completed.length,
      },
    }
  }

  /**
   * Get paginated deadlines with filters
   *
   * @param filters - Deadline filters
   * @param page - Page number
   * @param perPage - Results per page
   * @returns Paginated deadlines
   */
  async paginate(
    filters: DeadlineFilters,
    page: number = 1,
    perPage: number = 20
  ): Promise<ModelPaginatorContract<Deadline>> {
    const query = Deadline.query()

    query.withScopes((scopes) => {
      // Search filter
      if (filters.search) {
        scopes.search(filters.search)
      }

      // Status filter
      if (filters.status) {
        scopes.byStatus(filters.status)
      }

      // Case filter
      if (filters.caseId) {
        scopes.forCase(filters.caseId)
      }

      // Responsible filter
      if (filters.responsibleId) {
        scopes.assignedTo(filters.responsibleId)
      }

      // Fatal filter
      if (filters.isFatal !== undefined) {
        filters.isFatal ? scopes.fatal() : scopes.nonFatal()
      }

      // Date range filter
      if (filters.fromDate && filters.toDate) {
        scopes.dueBetween(filters.fromDate, filters.toDate)
      }

      // Include relationships
      scopes.withCase()
      scopes.withResponsible()

      // Default ordering by priority and date
      scopes.byPriority()
    })

    return query.paginate(page, perPage)
  }

  /**
   * Get deadlines that need alerts
   *
   * @returns List of deadlines requiring alerts
   */
  async getDeadlinesNeedingAlerts(): Promise<Deadline[]> {
    return Deadline.query()
      .withScopes((scopes) => {
        scopes.needsAlert()
        scopes.withCase()
        scopes.withResponsible()
        scopes.byDeadlineOrder()
      })
      .exec()
  }

  /**
   * Get fatal deadlines approaching
   *
   * @param days - Days to look ahead
   * @returns List of approaching fatal deadlines
   */
  async getFatalDeadlinesApproaching(days: number = 14): Promise<Deadline[]> {
    return Deadline.query()
      .withScopes((scopes) => {
        scopes.fatal()
        scopes.upcoming(days)
        scopes.withCase()
        scopes.withResponsible()
        scopes.byDeadlineOrder()
      })
      .exec()
  }

  /**
   * Get deadlines for a specific case
   *
   * @param caseId - Case ID
   * @param includeCompleted - Include completed deadlines
   * @returns List of case deadlines
   */
  async getCaseDeadlines(caseId: number, includeCompleted: boolean = false): Promise<Deadline[]> {
    const query = Deadline.query()

    query.withScopes((scopes) => {
      scopes.forCase(caseId)

      if (!includeCompleted) {
        scopes.pending()
      }

      scopes.withResponsible()
      scopes.byDeadlineOrder()
    })

    return query.exec()
  }

  /**
   * Get user's personal deadlines
   *
   * @param userId - User ID
   * @param options - Filter options
   * @returns User's deadlines
   */
  async getUserDeadlines(
    userId: number,
    options: {
      status?: 'pending' | 'completed' | 'expired' | 'cancelled'
      upcoming?: number
      page?: number
      perPage?: number
    } = {}
  ): Promise<ModelPaginatorContract<Deadline>> {
    const { status, upcoming, page = 1, perPage = 20 } = options

    const query = Deadline.query()

    query.withScopes((scopes) => {
      scopes.assignedTo(userId)

      if (status) {
        scopes.byStatus(status)
      } else if (upcoming) {
        scopes.upcoming(upcoming)
      }

      scopes.withCase()
      scopes.byPriority()
    })

    return query.paginate(page, perPage)
  }

  /**
   * Get deadline statistics for reporting
   *
   * @param filters - Optional filters
   * @returns Deadline statistics
   */
  async getStatistics(
    filters: {
      fromDate?: DateTime
      toDate?: DateTime
      responsibleId?: number
      caseId?: number
    } = {}
  ) {
    const { fromDate, toDate, responsibleId, caseId } = filters

    // Build base query
    const baseQuery = Deadline.query()

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

    return {
      total: total[0]?.$extras.total || 0,
      pending: pending[0]?.$extras.total || 0,
      completed: completed[0]?.$extras.total || 0,
      overdue: overdue[0]?.$extras.total || 0,
      fatal: fatal[0]?.$extras.total || 0,
      completionRate:
        total[0]?.$extras.total > 0
          ? ((completed[0]?.$extras.total || 0) / total[0]?.$extras.total) * 100
          : 0,
    }
  }

  /**
   * Get deadline calendar view
   * Returns deadlines grouped by date for calendar display
   *
   * @param month - Month to display
   * @param year - Year to display
   * @param responsibleId - Optional filter by responsible user
   * @returns Deadlines grouped by date
   */
  async getCalendarView(month: number, year: number, responsibleId?: number) {
    const startDate = DateTime.local(year, month, 1).startOf('month')
    const endDate = startDate.endOf('month')

    const query = Deadline.query()

    query.withScopes((scopes) => {
      scopes.dueBetween(startDate, endDate)

      if (responsibleId) {
        scopes.assignedTo(responsibleId)
      }

      scopes.withCase()
      scopes.byDeadlineOrder()
    })

    const deadlines = await query.exec()

    // Group deadlines by date
    const groupedByDate = deadlines.reduce(
      (acc, deadline) => {
        const dateKey = deadline.deadline_date.toFormat('yyyy-MM-dd')
        if (!acc[dateKey]) {
          acc[dateKey] = []
        }
        acc[dateKey].push(deadline)
        return acc
      },
      {} as Record<string, Deadline[]>
    )

    return groupedByDate
  }
}
