import factory from '@adonisjs/lucid/factories'
import ExportJob from '#modules/exports/models/export_job'
import { ensureRequestedByUserId, ensureTenantId } from '#database/factories/factory_helpers'

export const ExportJobFactory = factory
  .define(ExportJob, async () => {
    return {
      status: 'pending' as const,
      exportType: 'precatorios_csv',
      filters: {},
      filePath: null,
      expiresAt: null,
    }
  })
  .before('create', async (_, row) => {
    await ensureTenantId(row)
    await ensureRequestedByUserId(row)
  })
  .build()
