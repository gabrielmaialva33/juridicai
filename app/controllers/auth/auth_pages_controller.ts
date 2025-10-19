import type { HttpContext } from '@adonisjs/core/http'

/**
 * Controller responsible for rendering authentication Inertia pages
 * (login, register, onboarding)
 */
export default class AuthPagesController {
  /**
   * Render login page
   */
  async login({ inertia }: HttpContext) {
    return inertia.render('auth/login')
  }

  /**
   * Render register page
   */
  async register({ inertia }: HttpContext) {
    return inertia.render('auth/register')
  }

  /**
   * Render onboarding page (for new users)
   */
  async onboarding({ inertia }: HttpContext) {
    return inertia.render('auth/onboarding')
  }
}
