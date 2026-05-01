import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const OperationsController = () => import('#modules/operations/controllers/operations_controller')

router
  .group(() => {
    router
      .get('operations/desk', [OperationsController, 'desk'])
      .as('desk')
      .use(middleware.permission('operations.read'))
    router
      .get('operations/opportunities', [OperationsController, 'opportunities'])
      .as('opportunities.index')
      .use(middleware.permission('operations.read'))
    router
      .post('operations/opportunities/bulk-pipeline', [OperationsController, 'bulkMoveToPipeline'])
      .as('opportunities.bulk_pipeline')
      .use(middleware.permission('operations.manage'))
    router
      .get('operations/opportunities/:id', [OperationsController, 'show'])
      .as('opportunities.show')
      .use(middleware.permission('operations.read'))
    router
      .get('operations/opportunities/:id/liquidity', [OperationsController, 'liquidity'])
      .as('opportunities.liquidity')
      .use(middleware.permission('operations.read'))
    router
      .post('operations/opportunities/:id/pricing', [OperationsController, 'pricing'])
      .as('opportunities.pricing')
      .use(middleware.permission('operations.read'))
    router
      .post('operations/opportunities/:id/pipeline', [OperationsController, 'moveToPipeline'])
      .as('opportunities.pipeline')
      .use(middleware.permission('operations.manage'))
    router
      .get('operations/pipeline', [OperationsController, 'pipeline'])
      .as('pipeline')
      .use(middleware.permission('operations.read'))
  })
  .as('operations')
  .use(middleware.auth())
  .use(middleware.tenant())
