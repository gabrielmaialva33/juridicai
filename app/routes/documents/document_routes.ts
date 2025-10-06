import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle } from '#start/limiter'

const DocumentsController = () => import('#controllers/documents/documents_controller')

router
  .group(() => {
    router
      .get('/', [DocumentsController, 'paginate'])
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('documents.index')
    router
      .post('/', [DocumentsController, 'create'])
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('documents.store')
    router
      .get('/:id/download', [DocumentsController, 'download'])
      .where('id', /^\d+$/)
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('documents.download')
    router
      .get('/:id', [DocumentsController, 'get'])
      .where('id', /^\d+$/)
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('documents.show')
    router
      .patch('/:id', [DocumentsController, 'update'])
      .where('id', /^\d+$/)
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('documents.update')
    router
      .delete('/:id', [DocumentsController, 'delete'])
      .where('id', /^\d+$/)
      .use([middleware.auth(), middleware.tenant(), apiThrottle])
      .as('documents.destroy')
  })
  .prefix('/api/v1/documents')
