import factory from '@adonisjs/lucid/factories'
import { FactoryContextContract } from '@adonisjs/lucid/types/factory'
import { DateTime } from 'luxon'
import TenantUser, { TenantUserRole } from '#models/tenant_user'
import { TenantFactory } from './tenant_factory.js'
import { UserFactory } from './user_factory.js'

export const TenantUserFactory = factory
  .define(TenantUser, async ({ faker }: FactoryContextContract) => {
    return {
      role: faker.helpers.arrayElement([
        TenantUserRole.OWNER,
        TenantUserRole.ADMIN,
        TenantUserRole.LAWYER,
        TenantUserRole.ASSISTANT,
      ]),
      is_active: true,
      custom_permissions: null,
      joined_at: DateTime.now(),
    }
  })
  .relation('tenant', () => TenantFactory)
  .relation('user', () => UserFactory)
  .state('owner', (tenantUser) => {
    tenantUser.role = TenantUserRole.OWNER
    tenantUser.custom_permissions = null
  })
  .state('admin', (tenantUser) => {
    tenantUser.role = TenantUserRole.ADMIN
  })
  .state('lawyer', (tenantUser) => {
    tenantUser.role = TenantUserRole.LAWYER
  })
  .state('assistant', (tenantUser) => {
    tenantUser.role = TenantUserRole.ASSISTANT
    tenantUser.custom_permissions = ['cases:view', 'documents:view']
  })
  .state('inactive', (tenantUser) => {
    tenantUser.is_active = false
  })
  .state('pending', (tenantUser) => {
    tenantUser.joined_at = null
  })
  .build()
