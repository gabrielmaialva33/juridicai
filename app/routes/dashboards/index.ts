import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const DashboardsController = () => import('#controllers/dashboards_controller')

// Dashboard routes - require authentication and tenant context
router
  .group(() => {
    // Main dashboard page
    router.get('/dashboard', [DashboardsController, 'index']).as('dashboard.index')

    // Dashboard API endpoints for dynamic data loading
    router.get('/api/v1/dashboard/stats', [DashboardsController, 'stats']).as('dashboard.stats')

    router
      .get('/api/v1/dashboard/cases-chart', [DashboardsController, 'casesChartData'])
      .as('dashboard.cases_chart')

    router
      .get('/api/v1/dashboard/deadlines-chart', [DashboardsController, 'deadlinesChartData'])
      .as('dashboard.deadlines_chart')

    router
      .get('/api/v1/dashboard/recent-clients', [DashboardsController, 'recentClients'])
      .as('dashboard.recent_clients')

    router
      .get('/api/v1/dashboard/upcoming-deadlines', [DashboardsController, 'upcomingDeadlines'])
      .as('dashboard.upcoming_deadlines')

    router
      .get('/api/v1/dashboard/activity-feed', [DashboardsController, 'activityFeed'])
      .as('dashboard.activity_feed')
  })
  .use([middleware.auth(), middleware.tenant()])
