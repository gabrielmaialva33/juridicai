import { test } from '@japa/runner'
import djenPublicationSyncService from '#modules/integrations/services/djen_publication_sync_service'
import CoverageRun from '#modules/integrations/models/coverage_run'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

test.group('DJEN publication sync service', () => {
  test('runs scoped precatorio text searches per court and records coverage', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const requests: string[] = []

    const result = await djenPublicationSyncService.sync({
      tenantId: tenant.id,
      courtAliases: ['trf1'],
      searchTexts: ['precatório', 'RPV'],
      startDate: '2026-05-01',
      endDate: '2026-05-01',
      maxPagesPerCourt: 1,
      fetcher: fakeDjenFetch(requests),
      origin: 'manual_retry',
    })

    assert.equal(result.requestedCourts, 1)
    assert.deepEqual(result.searchTexts, ['precatório', 'RPV'])
    assert.lengthOf(result.courts, 2)
    assert.equal(result.courts[0].courtAlias, 'TRF1')
    assert.equal(result.courts[0].searchText, 'precatório')
    assert.equal(result.courts[1].searchText, 'RPV')
    assert.include(requests[0], 'siglaTribunal=TRF1')
    assert.include(requests[0], 'texto=precat')
    assert.include(requests[1], 'texto=RPV')

    const coverageRun = await CoverageRun.query()
      .where('tenant_id', tenant.id)
      .preload('sourceDataset')
      .firstOrFail()

    assert.equal(coverageRun.sourceDataset.key, 'djen-public-communications')
    assert.equal(coverageRun.status, 'completed')
    assert.deepEqual(coverageRun.scope?.searchTexts, ['precatório', 'RPV'])

    await cleanupTenantData(tenant)
  })
})

function fakeDjenFetch(requests: string[]) {
  return async (input: string | URL | Request) => {
    requests.push(String(input))

    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'success',
        count: 0,
        items: [],
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }
    )
  }
}

async function cleanupTenantData(tenant: Tenant) {
  await CoverageRun.query().where('tenant_id', tenant.id).delete()
  await tenant.delete()
}
