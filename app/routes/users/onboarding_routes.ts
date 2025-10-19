import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const OnboardingsController = () => import('#controllers/user/onboardings_controller')

router
  .group(() => {
    router
      .post('/onboarding/complete', [OnboardingsController, 'complete'])
      .as('user.onboarding.complete')
  })
  .prefix('/api/v1/user')
  .use(middleware.auth())
