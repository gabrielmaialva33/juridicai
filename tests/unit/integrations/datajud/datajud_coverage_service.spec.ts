import { test } from '@japa/runner'
import dataJudCoverageService from '#modules/integrations/services/datajud_coverage_service'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

test.group('DataJud coverage service', () => {
  test('reports tenant DataJud coverage by source and inferred court alias', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const otherTenant = await TenantFactory.create()

    const enriched = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'siop',
      cnjNumber: '0702042-05.2020.8.07.0003',
    }).create()
    await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'siop',
      cnjNumber: '0001234-94.2024.4.01.3400',
    }).create()
    await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'manual',
      cnjNumber: null,
    }).create()
    await PrecatorioAssetFactory.merge({
      tenantId: otherTenant.id,
      source: 'siop',
      cnjNumber: '0702042-05.2020.8.07.0003',
    }).create()
    await JudicialProcess.create({
      tenantId: tenant.id,
      assetId: enriched.id,
      source: 'datajud',
      cnjNumber: '0702042-05.2020.8.07.0003',
      rawData: {},
    })

    const report = await dataJudCoverageService.report({ tenantId: tenant.id })

    assert.include(report, {
      tenantId: tenant.id,
      assetsTotal: 3,
      assetsWithCnj: 2,
      assetsWithJudicialProcess: 1,
      missingCourtInference: 0,
      coveragePercent: 50,
    })
    assert.deepInclude(report.bySource.siop, {
      assetsTotal: 2,
      assetsWithCnj: 2,
      assetsWithJudicialProcess: 1,
      coveragePercent: 50,
    })
    assert.deepInclude(report.bySource.manual, {
      assetsTotal: 1,
      assetsWithCnj: 0,
      assetsWithJudicialProcess: 0,
      coveragePercent: 0,
    })
    assert.deepInclude(report.byCourtAlias.tjdft, {
      assetsTotal: 1,
      assetsWithCnj: 1,
      assetsWithJudicialProcess: 1,
      coveragePercent: 100,
    })
    assert.deepInclude(report.byCourtAlias.trf1, {
      assetsTotal: 1,
      assetsWithCnj: 1,
      assetsWithJudicialProcess: 0,
      coveragePercent: 0,
    })

    await cleanupTenants(tenant, otherTenant)
  })

  test('filters coverage by asset source', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'siop',
      cnjNumber: '0702042-05.2020.8.07.0003',
    }).create()
    await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'manual',
      cnjNumber: '0001234-94.2024.4.01.3400',
    }).create()

    const report = await dataJudCoverageService.report({
      tenantId: tenant.id,
      source: 'siop',
    })

    assert.include(report, {
      assetsTotal: 1,
      assetsWithCnj: 1,
      source: 'siop',
    })
    assert.deepEqual(Object.keys(report.bySource), ['siop'])

    await cleanupTenants(tenant)
  })
})

async function cleanupTenants(...tenants: Tenant[]) {
  for (const tenant of tenants) {
    await tenant.delete()
  }
}
