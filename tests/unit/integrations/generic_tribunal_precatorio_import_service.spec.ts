import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import genericTribunalPrecatorioImportService from '#modules/integrations/services/generic_tribunal_precatorio_import_service'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const CNJ_NUMBER = '0001234-94.2024.8.05.0001'

test.group('Generic tribunal precatorio import service', () => {
  test('imports extracted tribunal rows with CNJ into canonical assets', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createSourceRecord(tenant)

    const result = await genericTribunalPrecatorioImportService.importSourceRecord(sourceRecord.id)

    assert.deepEqual(result.stats, {
      totalRows: 1,
      validRows: 1,
      selectedRows: 1,
      inserted: 1,
      updated: 0,
      skipped: 0,
      errors: 0,
    })

    const asset = await PrecatorioAsset.query()
      .where('tenant_id', tenant.id)
      .where('cnj_number', CNJ_NUMBER)
      .firstOrFail()
    assert.equal(asset.source, 'tribunal')
    assert.equal(asset.exerciseYear, 2024)
    assert.equal(asset.lifecycleStatus, 'discovered')
    assert.equal(asset.complianceStatus, 'approved_for_analysis')

    const debtor = await asset.related('debtor').query().firstOrFail()
    assert.equal(debtor.name, 'Estado da Bahia')
    assert.equal(debtor.stateCode, 'BA')
    assert.equal(debtor.debtorType, 'state')

    const valuation = await AssetValuation.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    assert.equal(valuation.faceValue, '123456.78')

    const process = await JudicialProcess.query()
      .where('tenant_id', tenant.id)
      .where('cnj_number', CNJ_NUMBER)
      .firstOrFail()
    assert.equal(process.assetId, asset.id)
    assert.equal(process.courtAlias, 'tjba')

    const secondRun = await genericTribunalPrecatorioImportService.importSourceRecord(
      sourceRecord.id
    )
    assert.equal(secondRun.stats.inserted, 0)
    assert.equal(secondRun.stats.updated, 1)

    await tenant.delete()
    await rm(app.makePath('storage', 'tests', 'generic-tribunal-import', tenant.id), {
      recursive: true,
      force: true,
    })
  })
})

async function createSourceRecord(tenant: Tenant) {
  const directory = app.makePath('storage', 'tests', 'generic-tribunal-import', tenant.id)
  const filePath = join(directory, 'tjba-lista.csv')
  const contents = [
    'Numero do processo;Entidade devedora;Valor;Ano',
    `${CNJ_NUMBER};Estado da Bahia;R$ 123.456,78;2024`,
  ].join('\n')

  await mkdir(directory, { recursive: true })
  await writeFile(filePath, contents)

  return SourceRecord.create({
    tenantId: tenant.id,
    source: 'tribunal',
    sourceUrl: 'https://example.test/tjba-lista.csv',
    sourceFilePath: filePath,
    sourceChecksum: `generic-tribunal-import-${tenant.id}`,
    originalFilename: 'tjba-lista.csv',
    mimeType: 'text/csv',
    collectedAt: DateTime.now(),
    rawData: {
      providerId: 'generic-tribunal-public-source',
      targetKey: 'court-map:tjba',
      courtAlias: 'tjba',
      stateCode: 'BA',
      sourceKind: 'linked_document',
      format: 'csv',
    },
  })
}
