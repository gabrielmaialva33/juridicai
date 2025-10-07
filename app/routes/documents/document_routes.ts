import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle } from '#start/limiter'

const DocumentsController = () => import('#controllers/documents/documents_controller')

router
  .group(() => {
    router.get('/', [DocumentsController, 'paginate']).as('documents.index')
    router.post('/', [DocumentsController, 'create']).as('documents.store')
    router
      .get('/:id/download', [DocumentsController, 'download'])
      .where('id', /^\d+$/)
      .as('documents.download')
    router.get('/:id', [DocumentsController, 'get']).where('id', /^\d+$/).as('documents.show')
    router
      .patch('/:id', [DocumentsController, 'update'])
      .where('id', /^\d+$/)
      .as('documents.update')
    router
      .delete('/:id', [DocumentsController, 'delete'])
      .where('id', /^\d+$/)
      .as('documents.destroy')
  })
  .use([middleware.auth(), middleware.tenant(), apiThrottle])
  .prefix('/api/v1/documents')
