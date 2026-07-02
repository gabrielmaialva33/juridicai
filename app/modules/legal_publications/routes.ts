import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const LegalPublicationsController = () =>
  import('#modules/legal_publications/controllers/legal_publications_controller')

router
  .group(() => {
    router.get('legal-publications', [LegalPublicationsController, 'index']).as('index')
  })
  .as('legal_publications')
  .use(middleware.auth())
  .use(middleware.tenant())
  .use(middleware.permission('precatorios.read'))
