import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ImportController = () => import('#modules/siop/controllers/import_controller')

router
  .group(() => {
    router.get('siop/imports', [ImportController, 'index']).as('imports.index')
  })
  .as('siop')
  .use(middleware.auth())
  .use(middleware.tenant())
