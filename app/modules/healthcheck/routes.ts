import router from '@adonisjs/core/services/router'

const HealthzController = () => import('#modules/healthcheck/controllers/healthz_controller')

router.get('/healthz', [HealthzController, 'show']).as('healthz')
