import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const LoginController = () => import('#modules/auth/controllers/login_controller')
const SignupController = () => import('#modules/auth/controllers/signup_controller')

router
  .group(() => {
    router.get('signup', [SignupController, 'create']).as('signup.create')
    router.post('signup', [SignupController, 'store']).as('signup.store')

    router.get('login', [LoginController, 'create']).as('login.create')
    router.post('login', [LoginController, 'store']).as('login.store')
  })
  .as('auth')
  .use(middleware.guest())

router
  .group(() => {
    router.post('logout', [LoginController, 'destroy']).as('logout')
  })
  .as('auth')
  .use(middleware.auth())
