import { BaseSeeder } from '@adonisjs/lucid/seeders'
import logger from '@adonisjs/core/services/logger'
import Tenant from '#models/tenant'
import TenantUser from '#models/tenant_user'
import { ClientFactory } from '#database/factories/client_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { DeadlineFactory } from '#database/factories/deadline_factory'
import { DocumentFactory } from '#database/factories/document_factory'
import { CaseEventFactory } from '#database/factories/case_event_factory'
import TenantContextService from '#services/tenants/tenant_context_service'

export default class extends BaseSeeder {
  async run() {
    // Get all tenants
    const tenants = await Tenant.query().where('is_active', true)

    if (tenants.length === 0) {
      logger.warn('⚠️  No tenants found. Please run TenantSeeder first.')
      return
    }

    for (const tenant of tenants) {
      logger.info(`📁 Seeding legal data for tenant: ${tenant.name} (${tenant.subdomain})`)

      // Run seeding within tenant context
      await TenantContextService.run(
        { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
        async () => {
          // Get tenant users
          const tenantUsers = await TenantUser.query()
            .where('tenant_id', tenant.id)
            .where('is_active', true)

          if (tenantUsers.length === 0) {
            logger.warn(`   ⚠️  No users found for tenant ${tenant.subdomain}`)
            return
          }

          const userIds = tenantUsers.map((tu) => tu.user_id)
          const lawyers = tenantUsers.filter((tu) => tu.role === 'lawyer' || tu.role === 'owner')
          const lawyerIds = lawyers.map((tu) => tu.user_id)

          // Create clients (5 individuals, 3 companies)
          const individualClients = await ClientFactory.apply('individual').createMany(5)
          const companyClients = await ClientFactory.apply('company').createMany(3)
          const allClients = [...individualClients, ...companyClients]

          logger.info(`   ✓ Created ${allClients.length} clients`)

          // Create cases for each client
          let totalCases = 0
          let totalDeadlines = 0
          let totalDocuments = 0
          let totalEvents = 0

          for (const client of allClients) {
            // Each client has 1-3 cases
            const numCases = Math.floor(Math.random() * 3) + 1

            for (let i = 0; i < numCases; i++) {
              // Get random lawyer as responsible
              const responsibleLawyer = lawyerIds[Math.floor(Math.random() * lawyerIds.length)]

              const caseModel = await CaseFactory.merge({
                client_id: client.id,
                responsible_lawyer_id: responsibleLawyer,
              }).create()

              totalCases++

              // Create 2-5 deadlines per case
              const numDeadlines = Math.floor(Math.random() * 4) + 2
              for (let j = 0; j < numDeadlines; j++) {
                await DeadlineFactory.merge({
                  case_id: caseModel.id,
                  responsible_id: responsibleLawyer,
                }).create()
                totalDeadlines++
              }

              // Create 3-8 documents per case
              const numDocuments = Math.floor(Math.random() * 6) + 3
              for (let j = 0; j < numDocuments; j++) {
                const uploader = userIds[Math.floor(Math.random() * userIds.length)]
                await DocumentFactory.merge({
                  case_id: caseModel.id,
                  client_id: client.id,
                  uploaded_by: uploader,
                }).create()
                totalDocuments++
              }

              // Create 5-12 events per case
              const numEvents = Math.floor(Math.random() * 8) + 5
              for (let j = 0; j < numEvents; j++) {
                const creator = userIds[Math.floor(Math.random() * userIds.length)]
                await CaseEventFactory.merge({
                  case_id: caseModel.id,
                  created_by: creator,
                }).create()
                totalEvents++
              }
            }
          }

          logger.info(`   ✓ Created ${totalCases} cases`)
          logger.info(`   ✓ Created ${totalDeadlines} deadlines`)
          logger.info(`   ✓ Created ${totalDocuments} documents`)
          logger.info(`   ✓ Created ${totalEvents} case events`)
        }
      )
    }

    logger.info('✅ Legal data seeded successfully for all tenants!')
  }
}
