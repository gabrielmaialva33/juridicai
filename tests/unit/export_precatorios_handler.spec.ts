import { readFile } from 'node:fs/promises'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { handleExportPrecatorios } from '#modules/exports/jobs/export_precatorios_handler'
import ExportJob from '#modules/exports/models/export_job'
import Debtor from '#modules/debtors/models/debtor'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import { DebtorFactory } from '#database/factories/debtor_factory'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

test.group('export precatorios handler', () => {
  test('writes a tenant-scoped precatorios CSV and records the job run', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    try {
      const debtor = await DebtorFactory.merge({
        tenantId: tenant.id,
        name: 'União Federal',
        normalizedName: 'UNIAO FEDERAL',
        normalizedKey: 'UNIAO FEDERAL',
      }).create()
      await PrecatorioAssetFactory.merge({
        tenantId: tenant.id,
        debtorId: debtor.id,
        externalId: 'EXPORT-0001',
        cnjNumber: '0001234-94.2024.4.01.3400',
        faceValue: '1234.56',
        exerciseYear: 2024,
      }).create()
      const exportJob = await ExportJob.create({
        tenantId: tenant.id,
        requestedByUserId: null,
        status: 'pending',
        exportType: 'precatorios_csv',
        filters: { limit: 10 },
      })

      const result = await handleExportPrecatorios({
        tenantId: tenant.id,
        exportJobId: exportJob.id,
        requestId: 'export-test',
        bullmqJobId: `exports-precatorios-${tenant.id}-${exportJob.id}`,
        attempts: 1,
      })

      assert.equal(result.exportedRows, 1)

      const processedExport = await ExportJob.findOrFail(exportJob.id)
      assert.equal(processedExport.status, 'completed')
      assert.isNotNull(processedExport.filePath)
      assert.isNotNull(processedExport.expiresAt)

      const csv = await readFile(processedExport.filePath!, 'utf8')
      assert.include(csv, 'EXPORT-0001')
      assert.include(csv, 'União Federal')

      const [jobRun] = await db
        .from('radar_job_runs')
        .where('tenant_id', tenant.id)
        .where('job_name', 'exports-precatorios')
        .select('*')

      assert.equal(jobRun.status, 'completed')
      assert.equal(jobRun.metrics.exportedRows, 1)
    } finally {
      await cleanupTenantExportData(tenant)
    }
  })
})

async function cleanupTenantExportData(tenant: Tenant) {
  await db.from('radar_job_runs').where('tenant_id', tenant.id).delete()
  await ExportJob.query().where('tenant_id', tenant.id).delete()
  await PrecatorioAsset.query().where('tenant_id', tenant.id).delete()
  await Debtor.query().where('tenant_id', tenant.id).delete()
  await tenant.delete()
}
