import factory from '@adonisjs/lucid/factories'
import ExportJob from '#modules/exports/models/export_job'
import { TenantFactory } from '#database/factories/tenant_factory'
import { UserFactory } from '#database/factories/user_factory'

export const ExportJobFactory = factory
  .define(ExportJob, async () => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.create()

    return {
      tenantId: tenant.id,
      requestedByUserId: user.id,
      status: 'pending' as const,
      exportType: 'precatorios_csv',
      filters: {},
      filePath: null,
      expiresAt: null,
    }
  })
  .build()
