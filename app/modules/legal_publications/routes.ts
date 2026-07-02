import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const LegalPublicationsController = () =>
  import('#modules/legal_publications/controllers/legal_publications_controller')
const LegalPublicationMonitoringController = () =>
  import('#modules/legal_publications/controllers/legal_publication_monitoring_controller')

router
  .group(() => {
    router.get('legal-publications', [LegalPublicationsController, 'index']).as('index')
    router
      .get('legal-publications/monitoring', [LegalPublicationMonitoringController, 'index'])
      .as('monitoring')
    router
      .post('legal-publications/monitoring/cases', [
        LegalPublicationMonitoringController,
        'storeCase',
      ])
      .as('monitoring.cases.store')
    router
      .post('legal-publications/monitoring/cases/:id', [
        LegalPublicationMonitoringController,
        'updateCase',
      ])
      .as('monitoring.cases.update')
    router
      .post('legal-publications/monitoring/cases/:id/active', [
        LegalPublicationMonitoringController,
        'toggleCase',
      ])
      .as('monitoring.cases.active')
    router
      .post('legal-publications/monitoring/bar-registrations', [
        LegalPublicationMonitoringController,
        'storeBarRegistration',
      ])
      .as('monitoring.bar_registrations.store')
    router
      .post('legal-publications/monitoring/bar-registrations/:id', [
        LegalPublicationMonitoringController,
        'updateBarRegistration',
      ])
      .as('monitoring.bar_registrations.update')
    router
      .post('legal-publications/monitoring/bar-registrations/:id/active', [
        LegalPublicationMonitoringController,
        'toggleBarRegistration',
      ])
      .as('monitoring.bar_registrations.active')
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
