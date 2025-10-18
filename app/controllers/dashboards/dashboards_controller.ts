import type { HttpContext } from '@adonisjs/core/http'
import DashboardStatsService from '#services/dashboards/dashboard_stats_service'

export default class DashboardsController {
  /**
   * Show the dashboard page
   */
  async index({ inertia }: HttpContext) {
    return inertia.render('dashboard/index')
  }

  /**
   * Get dashboard statistics
   */
  async stats({ response }: HttpContext) {
    const stats = await DashboardStatsService.getStats()
    return response.json(stats)
  }

  /**
   * Get cases chart data
   */
  async casesChartData({ response }: HttpContext) {
    const data = await DashboardStatsService.getCasesChartData()
    return response.json(data)
  }

  /**
   * Get deadlines chart data
   */
  async deadlinesChartData({ response }: HttpContext) {
    const data = await DashboardStatsService.getDeadlinesChartData()
    return response.json(data)
  }

  /**
   * Get recent clients
   */
  async recentClients({ response }: HttpContext) {
    const clients = await DashboardStatsService.getRecentClients()
    return response.json(clients)
  }

  /**
   * Get upcoming deadlines
   */
  async upcomingDeadlines({ response }: HttpContext) {
    const deadlines = await DashboardStatsService.getUpcomingDeadlines()
    return response.json(deadlines)
  }

  /**
   * Get activity feed
   */
  async activityFeed({ response }: HttpContext) {
    const activities = await DashboardStatsService.getActivityFeed()
    return response.json(activities)
  }
}
