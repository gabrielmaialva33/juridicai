import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import trf4PrecatorioImportService from '#modules/integrations/services/trf4_precatorio_import_service'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetSourceLink from '#modules/precatorios/models/asset_source_link'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import ExternalIdentifier from '#modules/precatorios/models/external_identifier'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const TRF4_CSV = `
Notas explicativas:;;;;;;;;;;;
;;;;;;;;;;;
Nº de Ordem Cronológica; Proposta; Base legal para enquadramento na ordem cronológica; Número do Precatório; CPF/CNPJ parcial do beneficiário; Data de Autuação no TRF4; Atualizado Até; Parcela Devida; Valor Original Pago; Data Pagamento; Valor Pago;
1;2026;Alimentares, Art. 107 A, 8, Inciso II;5004648-80.2022.4.04.9388;109********;15/04/2022 19:05;abr/26;110.649,95;;;;
2;2026;Alimentares, Art. 107 A, 8, Inciso II;5004648-80.2022.4.04.9388;773********;15/04/2022 19:05;abr/26;45.443,75;;;;
3;2026;Comuns;5004649-65.2022.4.04.9388;420********;16/04/2022 16:49;abr/26;10.000,00;;;;
`

test.group('TRF4 precatorio import service', () => {
  test('consolidates TRF4 chronological rows into canonical assets and evidence', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createSourceRecord(tenant, TRF4_CSV)

    const result = await trf4PrecatorioImportService.importSourceRecord(sourceRecord.id)

    assert.deepEqual(result.stats, {
      totalRows: 3,
      validRows: 3,
      groupedPrecatorios: 2,
      inserted: 2,
      updated: 0,
      skipped: 0,
      errors: 0,
    })
    assert.deepEqual(result.chunking, {
      availableGroups: 2,
      selectedGroups: 2,
      chunkSize: 500,
      processedBatches: 1,
    })

    const asset = await PrecatorioAsset.query()
      .where('tenant_id', tenant.id)
      .where('cnj_number', '5004648-80.2022.4.04.9388')
      .firstOrFail()

    assert.equal(asset.source, 'tribunal')
    assert.equal(asset.externalId, 'trf4:5004648-80.2022.4.04.9388')
    assert.equal(asset.lifecycleStatus, 'discovered')
    assert.equal(asset.nature, 'alimentar')
    assert.equal(asset.piiStatus, 'pseudonymous')
    assert.deepEqual(asset.rawData?.beneficiaryDocumentMasks, ['109********', '773********'])

    const valuation = await AssetValuation.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    assert.equal(valuation.faceValue, '156093.70')
    assert.equal(valuation.estimatedUpdatedValue, '156093.70')
    assert.equal(valuation.queuePosition, 1)

    assert.equal(await countRows(PrecatorioAsset, tenant.id), 2)
    assert.equal(await countRows(JudicialProcess, tenant.id), 2)
    assert.equal(await countRows(AssetValuation, tenant.id), 2)
    assert.equal(await countRows(AssetEvent, tenant.id), 2)
    assert.equal(await countRows(AssetSourceLink, tenant.id), 2)
    assert.equal(await countRows(ExternalIdentifier, tenant.id), 4)

    const secondRun = await trf4PrecatorioImportService.importSourceRecord(sourceRecord.id)
    assert.equal(secondRun.stats.inserted, 0)
    assert.equal(secondRun.stats.updated, 2)
    assert.equal(await countRows(PrecatorioAsset, tenant.id), 2)
    assert.equal(await countRows(JudicialProcess, tenant.id), 2)
    assert.equal(await countRows(AssetEvent, tenant.id), 2)
    assert.equal(await countRows(AssetSourceLink, tenant.id), 2)
    assert.equal(await countRows(ExternalIdentifier, tenant.id), 4)

    await cleanupTenantData(tenant)
  })

  test('processes TRF4 groups in bounded chunks with an optional import limit', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createSourceRecord(tenant, TRF4_CHUNKED_CSV)

    const result = await trf4PrecatorioImportService.importSourceRecord(sourceRecord.id, {
      maxGroups: 2,
      chunkSize: 1,
    })

    assert.equal(result.stats.totalRows, 3)
    assert.equal(result.stats.validRows, 3)
    assert.equal(result.stats.groupedPrecatorios, 2)
    assert.equal(result.stats.inserted, 2)
    assert.deepEqual(result.chunking, {
      availableGroups: 3,
      selectedGroups: 2,
      chunkSize: 1,
      processedBatches: 2,
    })
    assert.equal(await countRows(PrecatorioAsset, tenant.id), 2)

    await cleanupTenantData(tenant)
  })
})

const TRF4_CHUNKED_CSV = `
Notas explicativas:;;;;;;;;;;;
;;;;;;;;;;;
Nº de Ordem Cronológica; Proposta; Base legal para enquadramento na ordem cronológica; Número do Precatório; CPF/CNPJ parcial do beneficiário; Data de Autuação no TRF4; Atualizado Até; Parcela Devida; Valor Original Pago; Data Pagamento; Valor Pago;
1;2026;Comuns;5004650-50.2022.4.04.9388;109********;15/04/2022 19:05;abr/26;110.649,95;;;;
2;2026;Comuns;5004651-35.2022.4.04.9388;773********;16/04/2022 16:49;abr/26;45.443,75;;;;
3;2026;Comuns;5004652-20.2022.4.04.9388;420********;17/04/2022 10:10;abr/26;10.000,00;;;;
`

async function createSourceRecord(tenant: Tenant, contents: string) {
  const directory = app.makePath('storage', 'tribunal', 'trf4', tenant.id)
  const filePath = join(directory, 'test-trf4.csv')

  await mkdir(directory, { recursive: true })
  await writeFile(filePath, Buffer.from(contents, 'latin1'))

  return SourceRecord.create({
    tenantId: tenant.id,
    source: 'tribunal',
    sourceUrl:
      'https://www.trf4.jus.br/trf4/salvar_como_txt.php?arq=precatorios_ordem_cronologica_O_20260502.csv',
    sourceFilePath: filePath,
    sourceChecksum: `trf4-import-test-${tenant.id}`,
    originalFilename: 'precatorios_ordem_cronologica_O_20260502.csv',
    mimeType: 'text/csv',
    fileSizeBytes: contents.length,
    collectedAt: DateTime.now(),
    rawData: {
      providerId: 'trf4-chronological-precatorios',
      courtAlias: 'trf4',
      sourceKind: 'federal_budget',
      formValue: 'O',
    },
  })
}

async function countRows(
  model:
    | typeof PrecatorioAsset
    | typeof JudicialProcess
    | typeof AssetValuation
    | typeof AssetEvent
    | typeof AssetSourceLink
    | typeof ExternalIdentifier,
  tenantId: string
) {
  const [result] = await model.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}

async function cleanupTenantData(tenant: Tenant) {
  await rm(app.makePath('storage', 'tribunal', 'trf4', tenant.id), {
    recursive: true,
    force: true,
  })
  await tenant.delete()
}
