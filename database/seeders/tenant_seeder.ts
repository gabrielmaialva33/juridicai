import { BaseSeeder } from '@adonisjs/lucid/seeders'
import logger from '@adonisjs/core/services/logger'
import { TenantFactory } from '#database/factories/tenant_factory'
import { UserFactory } from '#database/factories/user_factory'
import { TenantUserFactory } from '#database/factories/tenant_user_factory'

export default class extends BaseSeeder {
  async run() {
    // Create 3 test tenants with different plans
    const freeTenant = await TenantFactory.apply('free').create()

    const proTenant = await TenantFactory.apply('pro').create()

    const enterpriseTenant = await TenantFactory.merge({
      name: 'Silva & Associados Advocacia',
      subdomain: 'silva-adv',
      plan: 'enterprise',
    }).create()

    // Create users for each tenant
    // Free tenant: 1 owner + 1 lawyer
    const freeOwner = await UserFactory.create()
    await TenantUserFactory.apply('owner')
      .merge({
        tenant_id: freeTenant.id,
        user_id: freeOwner.id,
      })
      .create()

    const freeLawyer = await UserFactory.create()
    await TenantUserFactory.apply('lawyer')
      .merge({
        tenant_id: freeTenant.id,
        user_id: freeLawyer.id,
      })
      .create()

    // Pro tenant: 1 owner + 2 lawyers + 1 assistant
    const proOwner = await UserFactory.create()
    await TenantUserFactory.apply('owner')
      .merge({
        tenant_id: proTenant.id,
        user_id: proOwner.id,
      })
      .create()

    const proLawyer1 = await UserFactory.create()
    await TenantUserFactory.apply('lawyer')
      .merge({
        tenant_id: proTenant.id,
        user_id: proLawyer1.id,
      })
      .create()

    const proLawyer2 = await UserFactory.create()
    await TenantUserFactory.apply('lawyer')
      .merge({
        tenant_id: proTenant.id,
        user_id: proLawyer2.id,
      })
      .create()

    const proAssistant = await UserFactory.create()
    await TenantUserFactory.apply('assistant')
      .merge({
        tenant_id: proTenant.id,
        user_id: proAssistant.id,
      })
      .create()

    // Enterprise tenant: 1 owner + 3 lawyers + 2 assistants + 1 admin
    const enterpriseOwner = await UserFactory.merge({
      full_name: 'Dr. João Silva',
      email: 'joao.silva@silva-adv.com.br',
    }).create()
    await TenantUserFactory.apply('owner')
      .merge({
        tenant_id: enterpriseTenant.id,
        user_id: enterpriseOwner.id,
      })
      .create()

    const enterpriseAdmin = await UserFactory.merge({
      full_name: 'Maria Santos',
      email: 'maria.santos@silva-adv.com.br',
    }).create()
    await TenantUserFactory.apply('admin')
      .merge({
        tenant_id: enterpriseTenant.id,
        user_id: enterpriseAdmin.id,
      })
      .create()

    // Create 3 lawyers for enterprise tenant
    for (let i = 1; i <= 3; i++) {
      const lawyer = await UserFactory.create()
      await TenantUserFactory.apply('lawyer')
        .merge({
          tenant_id: enterpriseTenant.id,
          user_id: lawyer.id,
        })
        .create()
    }

    // Create 2 assistants for enterprise tenant
    for (let i = 1; i <= 2; i++) {
      const assistant = await UserFactory.create()
      await TenantUserFactory.apply('assistant')
        .merge({
          tenant_id: enterpriseTenant.id,
          user_id: assistant.id,
        })
        .create()
    }

    logger.info('✅ Tenants and users seeded successfully!')
    logger.info(`   - Free Tenant: ${freeTenant.subdomain} (${freeTenant.id})`)
    logger.info(`   - Pro Tenant: ${proTenant.subdomain} (${proTenant.id})`)
    logger.info(`   - Enterprise Tenant: ${enterpriseTenant.subdomain} (${enterpriseTenant.id})`)
  }
}
