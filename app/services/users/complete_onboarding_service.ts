import { inject } from '@adonisjs/core'
import TenantsRepository from '#repositories/tenants_repository'

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
  constructor(private tenantsRepository: TenantsRepository) {}

  async run(payload: CompleteOnboardingPayload) {
    const { firmName, tenantId } = payload

    // Update tenant with firm name
    // Additional fields like OAB, phone, and practice areas can be stored
    // later when creating the lawyer profile or in client records
    const tenant = await this.tenantsRepository.findBy('id', tenantId)
    if (!tenant) {
      throw new Error('Tenant not found')
    }

    await tenant.merge({ name: firmName }).save()

    return {
      success: true,
      tenant: tenant.toJSON(),
    }
  }
}
