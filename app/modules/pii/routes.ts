import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const RevealController = () => import('#modules/pii/controllers/reveal_controller')

router
  .group(() => {
    router
      .post('pii/beneficiaries/:id/reveal', [RevealController, 'show'])
      .as('beneficiaries.reveal')
  })
  .as('pii')
  .use(middleware.auth())
  .use(middleware.tenant())
  .use(middleware.permission('pii.reveal'))
