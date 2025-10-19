import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { createUserValidator, signInValidator } from '#validators/user'
import SignInService from '#services/users/sign_in_service'
import SignUpService from '#services/users/sign_up_service'
import SignOutService from '#services/users/sign_out_service'

@inject()
export default class SessionsController {
  constructor(
    private signInService: SignInService,
    private signUpService: SignUpService,
    private signOutService: SignOutService
  ) {}

  async signIn(ctx: HttpContext) {
    const { request, response } = ctx
    const { uid, password } = await request.validateUsing(signInValidator)

    try {
      const payload = await this.signInService.run({ uid, password, ctx })
      return response.json(payload)
    } catch (error) {
      return response.badRequest({
        errors: [
          {
            message: error.message,
          },
        ],
      })
    }
  }

  async signUp({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createUserValidator)

    const userWithAuth = await this.signUpService.run(payload)

    return response.created(userWithAuth)
  }

  async signOut(ctx: HttpContext) {
    const { response } = ctx

    await this.signOutService.run(ctx)

    return response.ok({
      message: 'Successfully signed out',
    })
  }
}
