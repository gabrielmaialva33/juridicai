import router from '@adonisjs/core/services/router'

const DashboardsController = () => import('#controllers/dashboards_controller')

// Demo route without authentication for UI preview
router.get('/dashboard-demo', [DashboardsController, 'index']).as('dashboard.demo')
