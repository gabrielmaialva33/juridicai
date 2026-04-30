import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ExportsController = () => import('#modules/exports/controllers/exports_controller')

router
  .group(() => {
    router.get('exports', [ExportsController, 'index']).as('index')
    router.post('exports', [ExportsController, 'store']).as('store')
    router.get('exports/:id', [ExportsController, 'show']).as('show')
    router.get('exports/:id/download', [ExportsController, 'download']).as('download')
  })
  .as('exports')
  .use(middleware.auth())
  .use(middleware.tenant())
  .use(middleware.permission('exports.manage'))
