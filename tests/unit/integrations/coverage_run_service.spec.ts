import { test } from '@japa/runner'
import coverageRunService from '#modules/integrations/services/coverage_run_service'
import CoverageRun from '#modules/integrations/models/coverage_run'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

test.group('Coverage run service', () => {
  test('records source coverage lifecycle metrics for a tenant', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const run = await coverageRunService.start({
      tenantId: tenant.id,
      sourceDatasetKey: 'datajud-public-api',
      origin: 'scheduler',
      scope: {
        courtAliases: ['tjdft'],
        pageSize: 100,
      },
    })

    assert.equal(run.status, 'running')
    assert.equal(run.origin, 'scheduler')
    assert.isNotNull(run.sourceDatasetId)
    assert.deepEqual(run.scope, {
      courtAliases: ['tjdft'],
      pageSize: 100,
    })

    const finished = await coverageRunService.finish(run, 'completed', {
      discoveredCount: 25,
      sourceRecordsCount: 1,
      createdAssetsCount: 4,
      linkedAssetsCount: 8,
      enrichedAssetsCount: 7,
      errorCount: 0,
      metrics: {
        pages: 1,
        hits: 25,
      },
    })

    assert.equal(finished.status, 'completed')
    assert.equal(finished.discoveredCount, 25)
    assert.equal(finished.sourceRecordsCount, 1)
    assert.equal(finished.createdAssetsCount, 4)
    assert.equal(finished.linkedAssetsCount, 8)
    assert.equal(finished.enrichedAssetsCount, 7)
    assert.equal(finished.errorCount, 0)
    assert.equal(finished.metrics?.hits, 25)
    assert.isNotNull(finished.finishedAt)

    await cleanupTenantCoverage(tenant)
  })

  test('keeps failed coverage runs auditable', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const run = await coverageRunService.start({
      tenantId: tenant.id,
      sourceDatasetKey: 'siop-open-data-precatorios',
      origin: 'scheduler',
      scope: {
        years: [2026],
      },
    })

    const finished = await coverageRunService.finish(run, 'failed', {
      error: new Error('Source unavailable'),
      errorCount: 1,
    })

    assert.equal(finished.status, 'failed')
    assert.equal(finished.errorCount, 1)
    assert.equal(finished.errorMessage, 'Source unavailable')

    await cleanupTenantCoverage(tenant)
  })
})

async function cleanupTenantCoverage(tenant: Tenant) {
  await CoverageRun.query().where('tenant_id', tenant.id).delete()
  await tenant.delete()
}
