import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import trf6PrecatorioImportService, {
  parseTrf6FederalBudgetCsv,
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

const TRF6_CSV = `
Notas explicativas:
qualquer texto antes do cabeçalho

Nº de Ordem Cronológica; Proposta; Base legal para enquadramento na ordem cronológica; Número do Precatório; CPF/CNPJ parcial do beneficiário; Data de Autuação no TRF6; Atualizado Até; Parcela Devida; Valor Original Pago; Data Pagamento; Valor Pago;
1;2026;Alimentares - Art - 107 A - 8 - Inciso II;6000003-67.2024.4.06.9388;657********;15/04/2024 17:52:02;04/2025;118.028,12;118.028,12;03/2026;122.039,97;
30095;2027;Não Alimentares - Art. 107 A - 8 - Inciso V;6001663-28.2026.4.06.9388;212***********;30/01/2026 16:29:58;02/2026;186.104,52;;;;
`.trim()

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

  test('parses TRF6 eproc CSV export after explanatory notes', ({ assert }) => {
    const rows = parseTrf6FederalBudgetCsv(TRF6_CSV)

    assert.lengthOf(rows, 2)
    assert.equal(rows[0].order, 1)
    assert.equal(rows[0].proposalYear, 2026)
    assert.equal(rows[0].processNumber, '6000003-67.2024.4.06.9388')
    assert.equal(rows[0].cnjNumber, '6000003-67.2024.4.06.9388')
    assert.equal(rows[0].beneficiaryDocumentMasked, '657********')
    assert.equal(rows[0].filedAt, '15/04/2024 17:52:02')
    assert.equal(rows[0].updatedUntil, '04/2025')
    assert.equal(rows[0].value, '118028.12')
    assert.equal(rows[0].paidValue, '122039.97')
    assert.equal(rows[0].preference, 'superpreferential')
    assert.equal(rows[0].nature, 'alimentar')
    assert.equal(rows[1].proposalYear, 2027)
    assert.equal(rows[1].nature, 'comum')
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

  test('imports TRF6 CSV rows with richer eproc metadata', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createSourceRecord(tenant, {
      filename: 'relatorio_precatorios_orcamentarios.csv',
      mimeType: 'text/csv',
      contents: Buffer.from(TRF6_CSV, 'latin1'),
    })

    const result = await trf6PrecatorioImportService.importSourceRecord(sourceRecord.id, {
      maxRows: 2,
      chunkSize: 1,
    })

    assert.equal(result.extraction.format, 'csv')
    assert.deepEqual(result.stats, {
      totalRows: 2,
      validRows: 2,
      selectedRows: 2,
      inserted: 2,
      updated: 0,
      skipped: 0,
      errors: 0,
    })

    const paidAsset = await PrecatorioAsset.query()
      .where('tenant_id', tenant.id)
      .where('cnj_number', '6000003-67.2024.4.06.9388')
      .firstOrFail()

    assert.equal(paidAsset.lifecycleStatus, 'paid')
    assert.equal(paidAsset.exerciseYear, 2026)
    assert.equal(paidAsset.piiStatus, 'pseudonymous')

    const valuation = await AssetValuation.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', paidAsset.id)
      .firstOrFail()

    assert.equal(valuation.faceValue, '118028.12')
    assert.equal(valuation.estimatedUpdatedValue, '122039.97')
    assert.equal(valuation.queuePosition, 1)

    const commonAsset = await PrecatorioAsset.query()
      .where('tenant_id', tenant.id)
      .where('cnj_number', '6001663-28.2026.4.06.9388')
      .firstOrFail()

    assert.equal(commonAsset.lifecycleStatus, 'discovered')
    assert.equal(commonAsset.exerciseYear, 2027)
    assert.equal(commonAsset.nature, 'comum')

    await cleanupTenantData(tenant)
  })
})

async function createSourceRecord(
  tenant: Tenant,
  file: {
    filename: string
    mimeType: string
    contents: Buffer
  } = {
    filename: 'test-trf6.pdf',
    mimeType: 'application/pdf',
    contents: Buffer.from('%PDF-1.4 fixture'),
  }
) {
  const directory = app.makePath('storage', 'tribunal', 'trf6', tenant.id)
  const filePath = join(directory, file.filename)

  await mkdir(directory, { recursive: true })
  await writeFile(filePath, file.contents)

  return SourceRecord.create({
    tenantId: tenant.id,
    source: 'tribunal',
    sourceUrl:
      'https://portal.trf6.jus.br/wp-content/uploads/2024/05/precatorios-federias-trf6-orcamento-2025.pdf',
    sourceFilePath: filePath,
    sourceChecksum: `trf6-import-test-${tenant.id}-${file.filename}`,
    originalFilename: file.filename,
    mimeType: file.mimeType,
    fileSizeBytes: file.contents.byteLength,
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
