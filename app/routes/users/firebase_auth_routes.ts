import router from '@adonisjs/core/services/router'
import { authThrottle } from '#start/limiter'

const FirebaseAuthController = () => import('#controllers/user/firebase_auth_controller')

router
  .group(() => {
    router
      .post('/google/sign-in', [FirebaseAuthController, 'googleSignIn'])
      .as('firebase.googleSignIn')
      .use(authThrottle)
  })
  .prefix('/api/v1/auth')
