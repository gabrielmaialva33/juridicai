import authService from '#modules/auth/services/auth_service'
import { signupValidator } from '#modules/auth/validators/signup_validator'
import type { HttpContext } from '@adonisjs/core/http'

export default class SignupController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/signup', {})
  }

  async store({ request, response, auth, session }: HttpContext) {
    const payload = await request.validateUsing(signupValidator)
    const { user, tenant } = await authService.createWorkspaceOwner(payload)

    await auth.use('web').login(user)
    session.put('active_tenant_id', tenant.id)
    response.redirect().toRoute('home')
  }
}
