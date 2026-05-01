import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ImportController = () => import('#modules/siop/controllers/import_controller')

router
  .group(() => {
    router
      .get('siop/imports', [ImportController, 'index'])
      .as('imports.index')
      .use(middleware.permission('imports.read'))
    router
      .get('siop/imports/new', [ImportController, 'newForm'])
      .as('imports.new')
      .use(middleware.permission('imports.manage'))
    router
      .post('siop/imports', [ImportController, 'store'])
      .as('imports.store')
      .use(middleware.permission('imports.manage'))
    router
      .get('siop/imports/:id', [ImportController, 'show'])
      .as('imports.show')
      .use(middleware.permission('imports.read'))
    router
      .get('siop/imports/:id/errors', [ImportController, 'errors'])
      .as('imports.errors')
      .use(middleware.permission('imports.read'))
    router
      .post('siop/imports/:id/reprocess', [ImportController, 'reprocess'])
      .as('imports.reprocess')
      .use(middleware.permission('imports.manage'))
    router
      .get('siop/imports/:id/download-source', [ImportController, 'downloadSource'])
      .as('imports.download_source')
      .use(middleware.permission('imports.manage'))
  })
  .as('siop')
  .use(middleware.auth())
  .use(middleware.tenant())
