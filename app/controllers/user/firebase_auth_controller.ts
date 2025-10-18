import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import GoogleSignInService from '#services/users/google_sign_in_service'
import { googleSignInValidator } from '#validators/firebase_auth'

@inject()
export default class FirebaseAuthController {
  constructor(private googleSignInService: GoogleSignInService) {}

  /**
   * Google Sign In with Firebase
   *
   * POST /api/v1/auth/google/sign-in
   */
  async googleSignIn({ request, response }: HttpContext) {
    const payload = await request.validateUsing(googleSignInValidator)

    try {
      const result = await this.googleSignInService.run(payload)
      return response.json(result)
    } catch (error) {
      return response.badRequest({
        errors: [
          {
            message: error.message || 'Google sign-in failed',
          },
        ],
      })
    }
  }
}
