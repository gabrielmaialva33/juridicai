import { inject } from '@adonisjs/core'
import TenantsRepository from '#repositories/tenants_repository'
import UsersRepository from '#repositories/users_repository'

interface CompleteOnboardingPayload {
  firmName: string
  oabNumber?: string
  phone?: string
  practiceAreas: string[]
  userId: number
  tenantId: string
}

@inject()
export default class CompleteOnboardingService {
  constructor(
    private tenantsRepository: TenantsRepository,
    private usersRepository: UsersRepository
  ) {}

  async run(payload: CompleteOnboardingPayload) {
    const { firmName, oabNumber, phone, practiceAreas, userId, tenantId } = payload

    // Update tenant with firm information
    const tenant = await this.tenantsRepository.findOrFail(tenantId)
    await tenant.merge({
      name: firmName,
      // Store onboarding data in metadata
      metadata: {
        ...(tenant.metadata || {}),
        oab_number: oabNumber,
        phone,
        practice_areas: practiceAreas,
        onboarding_completed_at: new Date().toISOString(),
      },
    }).save()

    // Update user to mark onboarding as complete
    const user = await this.usersRepository.findOrFail(userId)
    await user.merge({
      metadata: {
        ...(user.metadata || {}),
        onboarding_completed: true,
      },
    }).save()

    return {
      success: true,
      tenant: tenant.toJSON(),
      user: user.toJSON(),
    }
  }
}