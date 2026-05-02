import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import trf6PrecatorioImportService, {
  parseTrf6FederalBudgetText,
} from '#modules/integrations/services/trf6_precatorio_import_service'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetSourceLink from '#modules/precatorios/models/asset_source_link'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import ExternalIdentifier from '#modules/precatorios/models/external_identifier'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const TRF6_TEXT = `
PODER JUDICIÁRIO
TRIBUNAL REGIONAL FEDERAL DA 6ª REGIÃO
RELAÇÃO DE PRECATÓRIOS ENVIADA AO CJF, NOS TERMOS DA LDO, PARA INCLUSÃO NO
ORÇAMENTO GERAL DA UNIÃO DO EXERCÍCIO DE 2025. (Art. 12 da Res. 303/CNJ)
PRECATÓRIOS ALIMENTARES
ORDEM      PRECATÓRIO                  VALOR(R$)               PREFERÊNCIA*
     1 1747428420234019198                 166.274,98IDOSO
     2 1747436920234019198                 176.206,48NÃO
PRECATÓRIOS COMUNS (NÃO ALIMENTARES)
  9884 3897732420234019198                  76.940,89NÃO
`

test.group('TRF6 precatorio import service', () => {
  test('parses TRF6 federal budget-order PDF text into normalized rows', ({ assert }) => {
    const rows = parseTrf6FederalBudgetText(TRF6_TEXT)

    assert.lengthOf(rows, 3)
    assert.equal(rows[0].order, 1)
    assert.equal(rows[0].processNumber, '1747428420234019198')
    assert.equal(rows[0].cnjNumber, '0174742-84.2023.4.01.9198')
    assert.equal(rows[0].value, '166274.98')
    assert.equal(rows[0].preference, 'IDOSO')
    assert.equal(rows[0].nature, 'alimentar')
    assert.equal(rows[2].nature, 'comum')
  })

  test('imports TRF6 PDF rows into canonical assets and evidence', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createSourceRecord(tenant)

    const result = await trf6PrecatorioImportService.importSourceRecord(sourceRecord.id, {
      maxRows: 2,
      chunkSize: 1,
      pdfTextExtractor: async () => TRF6_TEXT,
    })

    assert.equal(result.extraction.format, 'pdf')
    assert.equal(result.extraction.status, 'extracted')
    assert.deepEqual(result.stats, {
      totalRows: 3,
      validRows: 3,
      selectedRows: 2,
      inserted: 2,
      updated: 0,
      skipped: 0,
      errors: 0,
    })
    assert.deepEqual(result.chunking, {
      availableRows: 3,
      selectedRows: 2,
      chunkSize: 1,
      processedBatches: 2,
    })

    const asset = await PrecatorioAsset.query()
      .where('tenant_id', tenant.id)
      .where('cnj_number', '0174742-84.2023.4.01.9198')
      .firstOrFail()

    assert.equal(asset.source, 'tribunal')
    assert.equal(asset.externalId, 'trf6:federal_budget_order:1747428420234019198:2025:1')
    assert.equal(asset.lifecycleStatus, 'discovered')
    assert.equal(asset.nature, 'alimentar')

    const valuation = await AssetValuation.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    assert.equal(valuation.estimatedUpdatedValue, '166274.98')
    assert.equal(valuation.queuePosition, 1)

    assert.equal(await countRows(PrecatorioAsset, tenant.id), 2)
    assert.equal(await countRows(JudicialProcess, tenant.id), 2)
    assert.equal(await countRows(AssetValuation, tenant.id), 2)
    assert.equal(await countRows(AssetEvent, tenant.id), 2)
    assert.equal(await countRows(AssetSourceLink, tenant.id), 2)
    assert.equal(await countRows(ExternalIdentifier, tenant.id), 4)

    const secondRun = await trf6PrecatorioImportService.importSourceRecord(sourceRecord.id, {
      maxRows: 2,
      chunkSize: 1,
      pdfTextExtractor: async () => TRF6_TEXT,
    })
    assert.equal(secondRun.stats.inserted, 0)
    assert.equal(secondRun.stats.updated, 2)
    assert.equal(await countRows(PrecatorioAsset, tenant.id), 2)
    assert.equal(await countRows(AssetSourceLink, tenant.id), 2)
    assert.equal(await countRows(ExternalIdentifier, tenant.id), 4)

    await cleanupTenantData(tenant)
  })
})

async function createSourceRecord(tenant: Tenant) {
  const directory = app.makePath('storage', 'tribunal', 'trf6', tenant.id)
  const filePath = join(directory, 'test-trf6.pdf')

  await mkdir(directory, { recursive: true })
  await writeFile(filePath, Buffer.from('%PDF-1.4 fixture'))

  return SourceRecord.create({
    tenantId: tenant.id,
    source: 'tribunal',
    sourceUrl:
      'https://portal.trf6.jus.br/wp-content/uploads/2024/05/precatorios-federias-trf6-orcamento-2025.pdf',
    sourceFilePath: filePath,
    sourceChecksum: `trf6-import-test-${tenant.id}`,
    originalFilename: 'federal_budget_order-2025.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 16,
    collectedAt: DateTime.now(),
    rawData: {
      providerId: 'trf6-federal-precatorio-orders',
      courtAlias: 'trf6',
      sourceKind: 'federal_budget_order',
      year: 2025,
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
  await rm(app.makePath('storage', 'tribunal', 'trf6', tenant.id), {
    recursive: true,
    force: true,
  })
  await tenant.delete()
}
