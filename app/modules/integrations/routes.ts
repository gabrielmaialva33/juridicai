import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const DataJudCandidatesController = () =>
  import('#modules/integrations/controllers/datajud_candidates_controller')
const GovernmentCoverageController = () =>
  import('#modules/integrations/controllers/government_coverage_controller')
const NationalDataCoherenceController = () =>
  import('#modules/integrations/controllers/national_data_coherence_controller')
const TribunalBudgetExecutionsController = () =>
  import('#modules/integrations/controllers/tribunal_budget_executions_controller')

router
  .group(() => {
    router
      .get('admin/integrations/coverage', [GovernmentCoverageController, 'index'])
      .as('government.coverage.index')
      .use(middleware.permission('imports.read'))
    router
      .get('admin/integrations/data-coherence', [NationalDataCoherenceController, 'index'])
      .as('government.data_coherence.index')
      .use(middleware.permission('imports.read'))
    router
      .get('admin/tribunal/budget-executions', [TribunalBudgetExecutionsController, 'index'])
      .as('tribunal.budget_executions.index')
      .use(middleware.permission('imports.read'))
    router
      .get('admin/datajud/candidates', [DataJudCandidatesController, 'index'])
      .as('datajud.candidates.index')
      .use(middleware.permission('integrations.datajud.read'))
    router
      .get('admin/datajud/candidates/:id', [DataJudCandidatesController, 'show'])
      .as('datajud.candidates.show')
      .use(middleware.permission('integrations.datajud.read'))
    router
      .post('admin/datajud/candidates/:id/accept', [DataJudCandidatesController, 'accept'])
      .as('datajud.candidates.accept')
      .use(middleware.permission('integrations.datajud.manage'))
    router
      .post('admin/datajud/candidates/:id/reject', [DataJudCandidatesController, 'reject'])
      .as('datajud.candidates.reject')
      .use(middleware.permission('integrations.datajud.manage'))
    router
      .post('admin/datajud/candidates/:id/ambiguous', [
        DataJudCandidatesController,
        'markAmbiguous',
      ])
      .as('datajud.candidates.ambiguous')
      .use(middleware.permission('integrations.datajud.manage'))
  })
  .as('integrations')
  .use(middleware.auth())
  .use(middleware.tenant())
