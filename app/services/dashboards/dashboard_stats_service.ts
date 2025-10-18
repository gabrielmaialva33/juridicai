import Client from '#models/client'
import Case from '#models/case'
import Deadline from '#models/deadline'
import Document from '#models/document'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

export default class DashboardStatsService {
  /**
   * Get general statistics for the dashboard
   */
  static async getStats() {
    const now = DateTime.now()
    const lastMonth = now.minus({ month: 1 })

    // Total clients (current and previous month)
    const totalClients = await Client.query().count('* as total')
    const clientsLastMonth = await Client.query()
      .where('created_at', '>=', lastMonth.toSQL())
      .count('* as total')

    // Total active cases
    const activeCases = await Case.query().where('status', 'ACTIVE').count('* as total')
    const activeCasesLastMonth = await Case.query()
      .where('status', 'ACTIVE')
      .where('created_at', '>=', lastMonth.toSQL())
      .count('* as total')

    // Pending deadlines
    const pendingDeadlines = await Deadline.query()
      .where('status', 'PENDING')
      .where('due_date', '>=', now.toSQL())
      .count('* as total')

    const pendingDeadlinesLastMonth = await Deadline.query()
      .where('status', 'PENDING')
      .where('due_date', '>=', lastMonth.toSQL())
      .where('due_date', '<', now.toSQL())
      .count('* as total')

    // Documents created this month
    const documentsThisMonth = await Document.query()
      .where('created_at', '>=', now.startOf('month').toSQL())
      .count('* as total')

    const documentsLastMonth = await Document.query()
      .where('created_at', '>=', lastMonth.startOf('month').toSQL())
      .where('created_at', '<', now.startOf('month').toSQL())
      .count('* as total')

    // Calculate percentage changes
    const clientsTotal = Number(totalClients[0].$extras.total)
    const clientsChange =
      Number(clientsLastMonth[0].$extras.total) > 0
        ? ((clientsTotal / Number(clientsLastMonth[0].$extras.total) - 1) * 100).toFixed(1)
        : 0

    const casesTotal = Number(activeCases[0].$extras.total)
    const casesChange =
      Number(activeCasesLastMonth[0].$extras.total) > 0
        ? ((casesTotal / Number(activeCasesLastMonth[0].$extras.total) - 1) * 100).toFixed(1)
        : 0

    const deadlinesTotal = Number(pendingDeadlines[0].$extras.total)
    const deadlinesChange =
      Number(pendingDeadlinesLastMonth[0].$extras.total) > 0
        ? ((deadlinesTotal / Number(pendingDeadlinesLastMonth[0].$extras.total) - 1) * 100).toFixed(
            1
          )
        : 0

    const docsTotal = Number(documentsThisMonth[0].$extras.total)
    const docsChange =
      Number(documentsLastMonth[0].$extras.total) > 0
        ? ((docsTotal / Number(documentsLastMonth[0].$extras.total) - 1) * 100).toFixed(1)
        : 0

    return {
      clients: { value: clientsTotal, change: Number(clientsChange) },
      activeCases: { value: casesTotal, change: Number(casesChange) },
      pendingDeadlines: { value: deadlinesTotal, change: Number(deadlinesChange) },
      documentsThisMonth: { value: docsTotal, change: Number(docsChange) },
    }
  }

  /**
   * Get cases chart data (new vs closed cases over time)
   */
  static async getCasesChartData() {
    const now = DateTime.now()
    const monthsAgo = now.minus({ months: 12 })

    // Get new cases per month
    const newCases = await db
      .from('cases')
      .select(db.raw("TO_CHAR(created_at, 'YYYY-MM') as month"))
      .count('* as count')
      .where('created_at', '>=', monthsAgo.toSQL())
      .groupByRaw("TO_CHAR(created_at, 'YYYY-MM')")
      .orderByRaw("TO_CHAR(created_at, 'YYYY-MM')")

    // Get closed cases per month
    const closedCases = await db
      .from('cases')
      .select(db.raw("TO_CHAR(closed_at, 'YYYY-MM') as month"))
      .count('* as count')
      .where('status', 'CLOSED')
      .where('closed_at', '>=', monthsAgo.toSQL())
      .whereNotNull('closed_at')
      .groupByRaw("TO_CHAR(closed_at, 'YYYY-MM')")
      .orderByRaw("TO_CHAR(closed_at, 'YYYY-MM')")

    // Build month labels
    const months = []
    const monthLabels = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ]

    for (let i = 11; i >= 0; i--) {
      const date = now.minus({ months: i })
      months.push({
        key: date.toFormat('yyyy-MM'),
        label: monthLabels[date.month - 1],
      })
    }

    // Map data to months
    const newCasesData = months.map((month) => {
      const found = newCases.find((c) => c.month === month.key)
      return found ? Number(found.count) : 0
    })

    const closedCasesData = months.map((month) => {
      const found = closedCases.find((c) => c.month === month.key)
      return found ? Number(found.count) : 0
    })

    return {
      months: months.map((m) => m.label),
      newCases: newCasesData,
      closedCases: closedCasesData,
    }
  }

  /**
   * Get deadlines chart data (deadlines per day for next 7 days)
   */
  static async getDeadlinesChartData() {
    const now = DateTime.now()
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

    const days = []
    for (let i = 0; i < 7; i++) {
      const date = now.plus({ days: i })
      days.push({
        date: date.toSQLDate(),
        label: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : weekDays[date.weekday % 7],
      })
    }

    const deadlinesData = await Promise.all(
      days.map(async (day) => {
        const count = await Deadline.query()
          .where('due_date', '>=', day.date)
          .where('due_date', '<', DateTime.fromSQL(day.date!).plus({ days: 1 }).toSQLDate()!)
          .where('status', 'PENDING')
          .count('* as total')

        return Number(count[0].$extras.total)
      })
    )

    return {
      categories: days.map((d) => d.label),
      values: deadlinesData,
    }
  }

  /**
   * Get recent clients
   */
  static async getRecentClients(limit: number = 5) {
    const clients = await Client.query()
      .select('id', 'full_name', 'email', 'tax_id', 'client_type', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(limit)

    // Get cases count for each client
    const clientsWithCases = await Promise.all(
      clients.map(async (client) => {
        const casesCount = await Case.query().where('client_id', client.id).count('* as total')

        return {
          id: client.id,
          name: client.full_name,
          email: client.email,
          cpf_cnpj: client.tax_id || '',
          type: client.client_type,
          created_at: client.created_at.toISODate(),
          cases_count: Number(casesCount[0].$extras.total),
        }
      })
    )

    return clientsWithCases
  }

  /**
   * Get upcoming deadlines
   */
  static async getUpcomingDeadlines(limit: number = 5) {
    const deadlines = await Deadline.query()
      .preload('caseRecord')
      .preload('responsible')
      .where('status', 'PENDING')
      .where('due_date', '>=', DateTime.now().toSQLDate()!)
      .orderBy('due_date', 'asc')
      .limit(limit)

    return deadlines.map((deadline) => ({
      id: deadline.id,
      title: deadline.title,
      case_number: deadline.caseRecord.number,
      case_id: deadline.caseRecord.id,
      due_date: deadline.due_date.toISODate(),
      priority: deadline.priority.toLowerCase(),
      responsible: deadline.responsible?.full_name || 'Não atribuído',
      status: deadline.status.toLowerCase(),
    }))
  }

  /**
   * Get activity feed
   * TODO: Replace with actual Activity model when it's created
   */
  static async getActivityFeed(limit: number = 8) {
    // For now, return mock data until Activity model is implemented
    const mockActivities = [
      {
        id: 1,
        type: 'document',
        title: 'Novo documento criado',
        description: 'Petição inicial criada',
        user: 'Sistema',
        timestamp: DateTime.now().minus({ hours: 2 }).toISO(),
        link: '/documents/1',
      },
      {
        id: 2,
        type: 'client',
        title: 'Cliente adicionado',
        description: 'Novo cliente cadastrado',
        user: 'Sistema',
        timestamp: DateTime.now().minus({ hours: 4 }).toISO(),
        link: '/clients/1',
      },
    ].slice(0, limit)

    return mockActivities
  }
}
