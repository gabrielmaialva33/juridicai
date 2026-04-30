import { test } from '@japa/runner'
import dataJudAssetEnrichmentService, {
  inferDataJudCourtAliases,
} from '#modules/integrations/services/datajud_asset_enrichment_service'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

test.group('DataJud asset enrichment service', () => {
  test('enriches tenant-scoped assets with CNJ numbers', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const otherTenant = await TenantFactory.create()

    await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'siop',
      cnjNumber: '0702042-05.2020.8.07.0003',
    }).create()
    await PrecatorioAssetFactory.merge({
      tenantId: otherTenant.id,
      source: 'siop',
      cnjNumber: '0702042-05.2020.8.07.0003',
    }).create()

    const metrics = await dataJudAssetEnrichmentService.enrich({
      tenantId: tenant.id,
      source: 'siop',
      fetcher: fakeDataJudFetch(),
      apiKey: 'test-key',
    })

    assert.include(metrics, {
      selected: 1,
      attempted: 1,
      synced: 1,
      errors: 0,
    })
    assert.equal(await countJudicialProcesses(tenant.id), 1)
    assert.equal(await countJudicialProcesses(otherTenant.id), 0)

    await cleanupTenants(tenant, otherTenant)
  })

  test('skips already enriched assets by default and can include them explicitly', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()

    await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'siop',
      cnjNumber: '0702042-05.2020.8.07.0003',
    }).create()

    await dataJudAssetEnrichmentService.enrich({
      tenantId: tenant.id,
      fetcher: fakeDataJudFetch(),
      apiKey: 'test-key',
    })

    const missingOnly = await dataJudAssetEnrichmentService.enrich({
      tenantId: tenant.id,
      fetcher: fakeDataJudFetch(),
      apiKey: 'test-key',
    })
    const includeExisting = await dataJudAssetEnrichmentService.enrich({
      tenantId: tenant.id,
      missingOnly: false,
      fetcher: fakeDataJudFetch(),
      apiKey: 'test-key',
    })

    assert.equal(missingOnly.selected, 0)
    assert.equal(includeExisting.selected, 1)
    assert.equal(includeExisting.attempted, 1)
    assert.equal(await countJudicialProcesses(tenant.id), 1)

    await cleanupTenants(tenant)
  })

  test('supports dry-run candidate inspection without persisting process metadata', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()

    await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'siop',
      cnjNumber: '0702042-05.2020.8.07.0003',
    }).create()

    const metrics = await dataJudAssetEnrichmentService.enrich({
      tenantId: tenant.id,
      dryRun: true,
      fetcher: fakeDataJudFetch(),
      apiKey: 'test-key',
    })

    assert.include(metrics, {
      selected: 1,
      attempted: 1,
      synced: 0,
      dryRun: true,
    })
    assert.equal(await countJudicialProcesses(tenant.id), 0)

    await cleanupTenants(tenant)
  })

  test('respects the enrichment limit', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'siop',
      cnjNumber: '0702042-05.2020.8.07.0003',
    }).create()
    await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'siop',
      cnjNumber: '0001234-94.2024.4.01.3400',
    }).create()

    const metrics = await dataJudAssetEnrichmentService.enrich({
      tenantId: tenant.id,
      limit: 1,
      fetcher: fakeDataJudFetch(),
      apiKey: 'test-key',
    })

    assert.equal(metrics.selected, 1)
    assert.equal(metrics.attempted, 1)
    assert.equal(await countJudicialProcesses(tenant.id), 1)

    await cleanupTenants(tenant)
  })

  test('infers DataJud court aliases from CNJ numbers', ({ assert }) => {
    assert.deepEqual(inferDataJudCourtAliases('0702042-05.2020.8.07.0003'), ['tjdft'])
    assert.deepEqual(inferDataJudCourtAliases('0001234-94.2024.4.01.3400'), ['trf1'])
  })
})

function fakeDataJudFetch() {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}'))
    const numeroProcesso = body.query.match.numeroProcesso
    const tribunal = String(input).includes('api_publica_trf1') ? 'TRF1' : 'TJDFT'

    return new Response(JSON.stringify(dataJudResponse(numeroProcesso, tribunal)), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}

function dataJudResponse(numeroProcesso: string, tribunal: string) {
  return {
    took: 10,
    timed_out: false,
    hits: {
      total: { value: 1, relation: 'eq' },
      hits: [
        {
          _index: `api_publica_${tribunal.toLowerCase()}`,
          _id: `${tribunal}_G1_${numeroProcesso}`,
          _source: {
            numeroProcesso,
            tribunal,
            dataAjuizamento: '20200128135532',
            classe: { codigo: 7, nome: 'Procedimento Comum Cível' },
            orgaoJulgador: { codigo: 43179, nome: '3a VARA CIVEL' },
            assuntos: [{ codigo: 4656, nome: 'Direito Autoral' }],
            movimentos: [],
          },
          sort: [1711149225049],
        },
      ],
    },
  }
}

async function countJudicialProcesses(tenantId: string) {
  const [result] = await JudicialProcess.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}

async function cleanupTenants(...tenants: Tenant[]) {
  for (const tenant of tenants) {
    await tenant.delete()
  }
}
