import factory from '@adonisjs/lucid/factories'
import { FactoryContextContract } from '@adonisjs/lucid/types/factory'
import { DateTime } from 'luxon'
import Tenant from '#models/tenant'

export const TenantFactory = factory
  .define(Tenant, async ({ faker }: FactoryContextContract) => {
    const companyName = faker.company.name()
    const subdomain = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30)
      .replace(/^-|-$/g, '')

    return {
      name: companyName,
      subdomain: subdomain + '-' + faker.string.alphanumeric(4).toLowerCase(),
      plan: faker.helpers.arrayElement(['free', 'starter', 'pro', 'enterprise'] as const),
      is_active: true,
      trial_ends_at: DateTime.now().plus({ days: 14 }),
      settings: {
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
        currency: 'BRL',
      },
    }
  })
  .state('free', (tenant) => {
    tenant.plan = 'free'
    tenant.trial_ends_at = DateTime.now().plus({ days: 14 })
  })
  .state('pro', (tenant) => {
    tenant.plan = 'pro'
  })
  .state('inactive', (tenant) => {
    tenant.is_active = false
    tenant.trial_ends_at = DateTime.now().minus({ days: 30 })
  })
  .build()
