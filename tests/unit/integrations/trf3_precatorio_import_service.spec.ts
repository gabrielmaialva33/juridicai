import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import trf3PrecatorioImportService from '#modules/integrations/services/trf3_precatorio_import_service'
import AssetBudgetFact from '#modules/precatorios/models/asset_budget_fact'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetSourceLink from '#modules/precatorios/models/asset_source_link'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import ExternalIdentifier from '#modules/precatorios/models/external_identifier'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const TRF3_CSV = [
  'Nº Ordem;Processo;Natureza do Crédito;Entidade Devedora;Valor Atualizado;Proposta;Data de Apresentação;Num Req',
  '1;0001234-88.2024.4.03.6100;Alimentar;INSS - Instituto Nacional do Seguro Social;1.247.892,00;2026;03/05/2025;20268303000123488',
  '2;SEM PROCESSO;Comum;União Federal;384.100,50;2026;04/05/2025;REQ-2',
].join('\n')

test.group('TRF3 precatorio import service', () => {
  test('imports TRF3 CNJ 102 CSV rows into canonical assets and evidence', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createSourceRecord(tenant)

    const result = await trf3PrecatorioImportService.importSourceRecord(sourceRecord.id, {
      maxRows: 1,
      chunkSize: 1,
    })

    assert.equal(result.extraction.format, 'csv')
    assert.equal(result.extraction.status, 'extracted')
    assert.deepEqual(result.stats, {
      totalRows: 2,
      validRows: 2,
      selectedRows: 1,
      inserted: 1,
      updated: 0,
      skipped: 0,
      errors: 0,
    })
    assert.deepEqual(result.chunking, {
      availableRows: 2,
      selectedRows: 1,
      chunkSize: 1,
      processedBatches: 1,
    })

    const asset = await PrecatorioAsset.query()
      .where('tenant_id', tenant.id)
      .where('cnj_number', '0001234-88.2024.4.03.6100')
      .firstOrFail()

    assert.equal(asset.source, 'tribunal')
    assert.include(asset.externalId ?? '', 'trf3:cnj_102_monthly_report:2026:3')
    assert.equal(asset.assetNumber, '0001234-88.2024.4.03.6100')
    assert.equal(asset.exerciseYear, 2026)
    assert.equal(asset.nature, 'alimentar')
    assert.equal(asset.lifecycleStatus, 'discovered')

    const valuation = await AssetValuation.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    assert.equal(valuation.estimatedUpdatedValue, '1247892.00')
    assert.equal(valuation.queuePosition, 1)

    assert.equal(await countRows(PrecatorioAsset, tenant.id), 1)
    assert.equal(await countRows(AssetValuation, tenant.id), 1)
    assert.equal(await countRows(AssetBudgetFact, tenant.id), 1)
    assert.equal(await countRows(JudicialProcess, tenant.id), 1)
    assert.equal(await countRows(AssetEvent, tenant.id), 1)
    assert.equal(await countRows(AssetSourceLink, tenant.id), 1)
    assert.equal(await countRows(ExternalIdentifier, tenant.id), 3)

    const secondRun = await trf3PrecatorioImportService.importSourceRecord(sourceRecord.id, {
      maxRows: 1,
      chunkSize: 1,
    })
    assert.equal(secondRun.stats.inserted, 0)
    assert.equal(secondRun.stats.updated, 1)
    assert.equal(await countRows(PrecatorioAsset, tenant.id), 1)
    assert.equal(await countRows(AssetSourceLink, tenant.id), 1)
    assert.equal(await countRows(ExternalIdentifier, tenant.id), 3)

    await cleanupTenantData(tenant)
  })
})

async function createSourceRecord(tenant: Tenant) {
  const directory = app.makePath('storage', 'tribunal', 'trf3', tenant.id)
  const filePath = join(directory, 'trf3-2026-03.csv')

  await mkdir(directory, { recursive: true })
  await writeFile(filePath, TRF3_CSV)

  return SourceRecord.create({
    tenantId: tenant.id,
    source: 'tribunal',
    sourceUrl: 'https://www.trf3.jus.br/documentos/sepe/RelatoriosCNJ_Res102/2026/marco.csv',
    sourceFilePath: filePath,
    sourceChecksum: `trf3-import-test-${tenant.id}`,
    originalFilename: 'marco.csv',
    mimeType: 'text/csv',
    fileSizeBytes: Buffer.byteLength(TRF3_CSV),
    collectedAt: DateTime.now(),
    rawData: {
      providerId: 'trf3-cnj-102-precatorios-rpv',
      courtAlias: 'trf3',
      sourceKind: 'cnj_102_monthly_report',
      year: 2026,
      month: 3,
      format: 'csv',
    },
  })
}

async function cleanupTenantData(tenant: Tenant) {
  await SourceRecord.query().where('tenant_id', tenant.id).delete()
  await rm(app.makePath('storage', 'tribunal', 'trf3', tenant.id), {
    recursive: true,
    force: true,
  })
  await tenant.delete()
}

async function countRows(
  model:
    | typeof PrecatorioAsset
    | typeof AssetValuation
    | typeof AssetBudgetFact
    | typeof JudicialProcess
    | typeof AssetEvent
    | typeof AssetSourceLink
    | typeof ExternalIdentifier,
  tenantId: string
) {
  const [result] = await model.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}
