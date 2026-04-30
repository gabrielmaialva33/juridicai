import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ExportsController = () => import('#modules/exports/controllers/exports_controller')

router
  .group(() => {
    router.get('exports', [ExportsController, 'index']).as('index')
  })
  .as('exports')
  .use(middleware.auth())
  .use(middleware.tenant())
