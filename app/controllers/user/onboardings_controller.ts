import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import CompleteOnboardingService from '#services/users/complete_onboarding_service'
import vine from '@vinejs/vine'

const completeOnboardingValidator = vine.compile(
  vine.object({
    firmName: vine.string().minLength(3),
    oabNumber: vine.string().optional(),
    phone: vine.string().optional(),
    practiceAreas: vine.array(vine.string()).minLength(1),
  })
)

@inject()
export default class OnboardingsController {
  constructor(private completeOnboardingService: CompleteOnboardingService) {}

  /**
   * Complete onboarding process
   * POST /api/v1/user/onboarding/complete
   */
  async complete({ request, response, auth }: HttpContext) {
    const user = auth.user!
    const payload = await request.validateUsing(completeOnboardingValidator)

    try {
      const result = await this.completeOnboardingService.run({
        ...payload,
        userId: user.id,
        tenantId: user.tenant_id,
      })

      return response.json(result)
    } catch (error) {
      return response.badRequest({
        errors: [
          {
            message: error.message || 'Onboarding completion failed',
          },
        ],
      })
    }
  }
}
