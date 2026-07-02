import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const LegalPublicationsController = () =>
  import('#modules/legal_publications/controllers/legal_publications_controller')

router
  .group(() => {
    router.get('legal-publications', [LegalPublicationsController, 'index']).as('index')
    router
      .post('legal-publications/:id/confirm', [LegalPublicationsController, 'confirm'])
      .as('confirm')
    router
      .post('legal-publications/:id/dismiss', [LegalPublicationsController, 'dismiss'])
      .as('dismiss')
    router
      .post('legal-publications/:id/deadline', [LegalPublicationsController, 'updateDeadline'])
      .as('deadline.update')
    router
      .post('legal-publications/:id/interpretation', [
        LegalPublicationsController,
        'updateInterpretation',
      ])
      .as('interpretation.update')
  })
  .as('legal_publications')
  .use(middleware.auth())
  .use(middleware.tenant())
  .use(middleware.permission('precatorios.read'))
