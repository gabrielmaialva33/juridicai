import authService from '#modules/auth/services/auth_service'
import { loginValidator } from '#modules/auth/validators/login_validator'
import type { HttpContext } from '@adonisjs/core/http'

export default class LoginController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/login', {})
  }

  async store({ request, auth, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)
    const user = await authService.verifyCredentials(email, password)

    await auth.use('web').login(user)
    response.redirect().toRoute('home')
  }

  async destroy({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    response.redirect('/login')
  }
}
