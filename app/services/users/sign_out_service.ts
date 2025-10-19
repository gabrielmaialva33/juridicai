import type { HttpContext } from '@adonisjs/core/http'
import AuthEventService from '#services/users/auth_event_service'

/**
 * Service responsible for handling user sign-out
 * Clears JWT tokens from cookies
 */
export default class SignOutService {
  /**
   * Sign out user by clearing authentication cookies
   */
  async run(ctx: HttpContext): Promise<void> {
    const { response, auth } = ctx

    // Get current user before logout (for audit log)
    const user = auth.user

    // Clear JWT tokens from cookies
    response.clearCookie('access_token')
    response.clearCookie('refresh_token')

    // Emit logout event for audit logging
    if (user) {
      AuthEventService.emitLogoutSucceeded(user, ctx)
    }
  }
}
