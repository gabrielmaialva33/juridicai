import factory from '@adonisjs/lucid/factories'
import { FactoryContextContract } from '@adonisjs/lucid/types/factory'
import { DateTime } from 'luxon'
import TenantUser from '#models/tenant_user'
import { TenantFactory } from './tenant_factory.js'
import { UserFactory } from './user_factory.js'

export const TenantUserFactory = factory
  .define(TenantUser, async ({ faker }: FactoryContextContract) => {
    return {
      role: faker.helpers.arrayElement(['lawyer', 'assistant', 'admin'] as const),
      is_active: true,
      custom_permissions: null,
      invited_by: null,
      joined_at: DateTime.now(),
    }
  })
  .relation('tenant', () => TenantFactory)
  .relation('user', () => UserFactory)
  .state('owner', (tenantUser) => {
    tenantUser.role = 'owner'
    tenantUser.custom_permissions = null
  })
  .state('admin', (tenantUser) => {
    tenantUser.role = 'admin'
  })
  .state('lawyer', (tenantUser) => {
    tenantUser.role = 'lawyer'
  })
  .state('assistant', (tenantUser) => {
    tenantUser.role = 'assistant'
    tenantUser.custom_permissions = ['cases:view', 'documents:view']
  })
  .state('inactive', (tenantUser) => {
    tenantUser.is_active = false
  })
  .state('pending', (tenantUser) => {
    tenantUser.joined_at = null
  })
  .build()
