import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import debtorRepository from '#modules/debtors/repositories/debtor_repository'
import precatorioRepository from '#modules/precatorios/repositories/precatorio_repository'
import Debtor from '#modules/debtors/models/debtor'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import { DebtorFactory } from '#database/factories/debtor_factory'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

test.group('API list filters', () => {
  test('filters precatorio assets by tenant and integration query parameters', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const otherTenant = await TenantFactory.create()
    const debtor = await DebtorFactory.merge({
      tenantId: tenant.id,
      name: 'União Federal',
      normalizedName: 'UNIAO FEDERAL',
      normalizedKey: `uniao-federal-${tenant.id}`,
      debtorType: 'union',
      stateCode: 'DF',
    }).create()

    const expected = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      debtorId: debtor.id,
      externalId: `SIOP-FILTER-${tenant.id}`,
      cnjNumber: '0001234-94.2024.4.01.3400',
      nature: 'alimentar',
      lifecycleStatus: 'discovered',
      complianceStatus: 'approved_for_analysis',
      faceValue: '100000.00',
      exerciseYear: 2024,
    }).create()

    await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      debtorId: debtor.id,
      externalId: `SIOP-OTHER-${tenant.id}`,
      nature: 'comum',
      lifecycleStatus: 'paid',
      complianceStatus: 'blocked',
      faceValue: '500.00',
      exerciseYear: 2020,
    }).create()

    await PrecatorioAssetFactory.merge({
      tenantId: otherTenant.id,
      externalId: `SIOP-FILTER-${otherTenant.id}`,
      nature: 'alimentar',
      lifecycleStatus: 'discovered',
      complianceStatus: 'approved_for_analysis',
      faceValue: '100000.00',
      exerciseYear: 2024,
    }).create()

    const page = await precatorioRepository.list(tenant.id, {
      page: 1,
      limit: 25,
      q: 'SIOP-FILTER',
      debtorId: debtor.id,
      source: 'siop',
      nature: 'alimentar',
      lifecycleStatus: 'discovered',
      complianceStatus: 'approved_for_analysis',
      exerciseYearFrom: 2024,
      exerciseYearTo: 2024,
      minFaceValue: 1000,
      maxFaceValue: 200000,
      sortBy: 'face_value',
      sortDirection: 'desc',
    })

    assert.lengthOf(page.all(), 1)
    assert.equal(page.all()[0].id, expected.id)

    await cleanupTenantData(tenant)
    await cleanupTenantData(otherTenant)
  })

  test('filters debtors by tenant and integration query parameters', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const otherTenant = await TenantFactory.create()
    const expected = await DebtorFactory.merge({
      tenantId: tenant.id,
      name: 'Instituto Nacional do Seguro Social',
      normalizedName: 'INSTITUTO NACIONAL DO SEGURO SOCIAL',
      normalizedKey: `inss-${tenant.id}`,
      debtorType: 'autarchy',
      cnpj: null,
      stateCode: 'SP',
      paymentRegime: 'federal_unique',
    }).create()

    await DebtorFactory.merge({
      tenantId: tenant.id,
      name: 'União Federal',
      normalizedName: 'UNIAO FEDERAL',
      normalizedKey: `uniao-${tenant.id}`,
      debtorType: 'union',
      cnpj: null,
      stateCode: 'DF',
      paymentRegime: 'federal_unique',
    }).create()

    await DebtorFactory.merge({
      tenantId: otherTenant.id,
      name: 'Instituto Nacional do Seguro Social',
      normalizedName: 'INSTITUTO NACIONAL DO SEGURO SOCIAL',
      normalizedKey: `inss-${otherTenant.id}`,
      debtorType: 'autarchy',
      cnpj: null,
      stateCode: 'SP',
      paymentRegime: 'federal_unique',
    }).create()

    const page = await debtorRepository.list(tenant.id, {
      page: 1,
      limit: 25,
      q: 'seguro social',
      debtorType: 'autarchy',
      stateCode: 'SP',
      paymentRegime: 'federal_unique',
      sortBy: 'name',
      sortDirection: 'asc',
    })

    assert.lengthOf(page.all(), 1)
    assert.equal(page.all()[0].id, expected.id)

    await cleanupTenantData(tenant)
    await cleanupTenantData(otherTenant)
  })
})

async function cleanupTenantData(tenant: Tenant) {
  const assets = await PrecatorioAsset.query().where('tenant_id', tenant.id).select('id')
  const assetIds = assets.map((asset) => asset.id)

  if (assetIds.length > 0) {
    await db.from('asset_scores').whereIn('asset_id', assetIds).delete()
    await db.from('asset_events').whereIn('asset_id', assetIds).delete()
  }

  await PrecatorioAsset.query().where('tenant_id', tenant.id).delete()
  await Debtor.query().where('tenant_id', tenant.id).delete()
  await tenant.delete()
}
