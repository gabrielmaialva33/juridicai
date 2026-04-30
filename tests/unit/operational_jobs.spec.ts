import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { handleApplyRetentionPolicy } from '#modules/maintenance/jobs/apply_retention_policy_handler'
import { handleSiopReconcile } from '#modules/siop/jobs/siop_reconcile_handler'
import ClientError from '#modules/client_errors/models/client_error'
import SiopImport from '#modules/siop/models/siop_import'
import SourceRecord from '#modules/siop/models/source_record'
import { ClientErrorFactory } from '#database/factories/client_error_factory'
import { SiopImportFactory } from '#database/factories/siop_import_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

test.group('operational jobs', () => {
  test('marks stale SIOP imports as failed during reconciliation', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    try {
      const siopImport = await SiopImportFactory.merge({
        tenantId: tenant.id,
        status: 'running',
      }).create()
      await db
        .from('siop_imports')
        .where('id', siopImport.id)
        .update({ updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000) })

      const metrics = await handleSiopReconcile({
        staleAfterMinutes: 60,
        origin: 'manual_retry',
      })

      assert.equal(metrics.staleImports, 1)

      const reconciledImport = await SiopImport.findOrFail(siopImport.id)
      assert.equal(reconciledImport.status, 'failed')

      const [jobRun] = await db
        .from('radar_job_runs')
        .where('job_name', 'siop-reconcile')
        .orderBy('created_at', 'desc')
        .select('*')

      assert.equal(jobRun.status, 'completed')
      assert.equal(jobRun.origin, 'manual_retry')
    } finally {
      await cleanupTenantOperationalData(tenant)
    }
  })

  test('records retention manifests in dry-run mode without deleting rows', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    try {
      const clientError = await ClientErrorFactory.merge({ tenantId: tenant.id }).create()
      await db
        .from('client_errors')
        .where('id', clientError.id)
        .update({ created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) })
      await db.table('retention_config').insert({
        tenant_id: tenant.id,
        subject: 'client_errors',
        retention_days: 1,
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      })

      const metrics = await handleApplyRetentionPolicy({
        dryRun: true,
        origin: 'manual_retry',
      })

      assert.equal(metrics.dryRun, true)
      assert.equal(metrics.manifestRows, 1)
      assert.equal(metrics.deletedRows, 0)
      assert.isNotNull(await ClientError.find(clientError.id))

      const [manifest] = await db
        .from('retention_manifest')
        .where('tenant_id', tenant.id)
        .where('subject', 'client_errors')
        .select('*')

      assert.equal(manifest.deleted_count, 0)
      assert.equal(manifest.metadata.dryRun, true)
      assert.equal(manifest.metadata.estimatedRows, 1)
    } finally {
      await cleanupTenantOperationalData(tenant)
    }
  })
})

async function cleanupTenantOperationalData(tenant: Tenant) {
  const imports = await SiopImport.query()
    .where('tenant_id', tenant.id)
    .select('id', 'sourceRecordId')
  const sourceRecordIds = imports.map((row) => row.sourceRecordId)

  await db
    .from('radar_job_runs')
    .whereIn('job_name', ['siop-reconcile', 'maintenance-apply-retention-policy'])
    .delete()
  await db.from('retention_manifest').where('tenant_id', tenant.id).delete()
  await db.from('retention_config').where('tenant_id', tenant.id).delete()
  await ClientError.query().where('tenant_id', tenant.id).delete()
  await SiopImport.query().where('tenant_id', tenant.id).delete()

  if (sourceRecordIds.length > 0) {
    await SourceRecord.query().whereIn('id', sourceRecordIds).delete()
  }

  await tenant.delete()
}
