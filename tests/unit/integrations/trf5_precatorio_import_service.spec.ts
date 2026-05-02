import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import trf5PrecatorioImportService, {
  parseTrf5ReportText,
} from '#modules/integrations/services/trf5_precatorio_import_service'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetSourceLink from '#modules/precatorios/models/asset_source_link'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import ExternalIdentifier from '#modules/precatorios/models/external_identifier'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const TRF5_TEXT = `
Relatório de Processos Incluídos na Proposta Orçamentária
Data-Base 03/04/2024
Exercício 2025
Entidade Devedora: INSS - INSTITUTO NACIONAL DO SEGURO SOCIAL
Natureza Crédito: Natureza alimentar

Nº Ordem Processo                    PRC/UF           Natureza do Crédito    Proc. Orig./Execução     Num Req                Valor Atualizado   Superpreferencial

1      0292531-42.2023.4.05.0000    PRC245996-PB (@) Natureza alimentar      0500494-14.2021.4.05.8205 20238205014500414           105.251,14    Idoso

Data de Apresentação 03/05/2023
Deprecante           : JUÍZO DA 14ª VARA FEDERAL DA PARAÍBA - PATOS

2      0292532-27.2023.4.05.0000    PRC245997-PE (@) Natureza alimentar      0502013-43.2020.4.05.8307 20238307026500298           117.490,94

Data de Apresentação 03/05/2023
Deprecante           : JUIZO DA 26ª VARA FEDERAL DE PERNAMBUCO - PALMARES
`

test.group('TRF5 precatorio import service', () => {
  test('parses TRF5 federal debt report text into normalized rows', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createSourceRecord(tenant, 'federal_debt')
    const rows = parseTrf5ReportText(TRF5_TEXT, sourceRecord)

    assert.lengthOf(rows, 2)
    assert.equal(rows[0].order, 1)
    assert.equal(rows[0].processNumber, '0292531-42.2023.4.05.0000')
    assert.equal(rows[0].cnjNumber, '0292531-42.2023.4.05.0000')
    assert.equal(rows[0].prcNumber, 'PRC245996-PB')
    assert.equal(rows[0].originProcessNumber, '0500494-14.2021.4.05.8205')
    assert.equal(rows[0].requestNumber, '20238205014500414')
    assert.equal(rows[0].value, '105251.14')
    assert.equal(rows[0].superPreference, 'Idoso')

    await cleanupTenantData(tenant)
  })

  test('imports TRF5 PDF rows into canonical assets and evidence', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createSourceRecord(tenant, 'federal_debt')

    const result = await trf5PrecatorioImportService.importSourceRecord(sourceRecord.id, {
      maxRows: 1,
      chunkSize: 1,
      pdfTextExtractor: async () => TRF5_TEXT,
    })

    assert.equal(result.extraction.format, 'pdf')
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
      .where('cnj_number', '0292531-42.2023.4.05.0000')
      .firstOrFail()

    assert.equal(asset.source, 'tribunal')
    assert.equal(asset.externalId, 'trf5:federal_debt:0292531-42.2023.4.05.0000:20238205014500414')
    assert.equal(asset.lifecycleStatus, 'discovered')
    assert.equal(asset.nature, 'alimentar')

    const valuation = await AssetValuation.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    assert.equal(valuation.estimatedUpdatedValue, '105251.14')
    assert.equal(valuation.queuePosition, 1)

    assert.equal(await countRows(PrecatorioAsset, tenant.id), 1)
    assert.equal(await countRows(JudicialProcess, tenant.id), 1)
    assert.equal(await countRows(AssetValuation, tenant.id), 1)
    assert.equal(await countRows(AssetEvent, tenant.id), 1)
    assert.equal(await countRows(AssetSourceLink, tenant.id), 1)
    assert.equal(await countRows(ExternalIdentifier, tenant.id), 4)

    const secondRun = await trf5PrecatorioImportService.importSourceRecord(sourceRecord.id, {
      maxRows: 1,
      chunkSize: 1,
      pdfTextExtractor: async () => TRF5_TEXT,
    })
    assert.equal(secondRun.stats.inserted, 0)
    assert.equal(secondRun.stats.updated, 1)
    assert.equal(await countRows(PrecatorioAsset, tenant.id), 1)
    assert.equal(await countRows(AssetSourceLink, tenant.id), 1)
    assert.equal(await countRows(ExternalIdentifier, tenant.id), 4)

    await cleanupTenantData(tenant)
  })
})

async function createSourceRecord(tenant: Tenant, sourceKind: 'federal_debt' | 'paid_precatorios') {
  const directory = app.makePath('storage', 'tribunal', 'trf5', tenant.id)
  const filePath = join(directory, 'test-trf5.pdf')

  await mkdir(directory, { recursive: true })
  await writeFile(filePath, Buffer.from('%PDF-1.4 fixture'))

  return SourceRecord.create({
    tenantId: tenant.id,
    source: 'tribunal',
    sourceUrl: 'https://rpvprecatorio.trf5.jus.br/downloadDividaFederal/554',
    sourceFilePath: filePath,
    sourceChecksum: `trf5-import-test-${tenant.id}-${sourceKind}`,
    originalFilename: 'federal_debt-2025-554.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 16,
    collectedAt: DateTime.now(),
    rawData: {
      providerId: 'trf5-precatorio-reports',
      courtAlias: 'trf5',
      sourceKind,
      year: 2025,
      debtorName: 'INSS - INSTITUTO NACIONAL DO SEGURO SOCIAL - ALIMENTAR',
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
  await rm(app.makePath('storage', 'tribunal', 'trf5', tenant.id), {
    recursive: true,
    force: true,
  })
  await tenant.delete()
}
