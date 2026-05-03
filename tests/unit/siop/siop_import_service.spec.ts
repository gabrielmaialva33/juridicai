import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { handleSiopImport } from '#modules/siop/jobs/siop_import_handler'
import siopImportService from '#modules/siop/services/siop_import_service'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetScore from '#modules/precatorios/models/asset_score'
import AssetBudgetFact from '#modules/precatorios/models/asset_budget_fact'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import AssetSourceLink from '#modules/precatorios/models/asset_source_link'
import Debtor from '#modules/debtors/models/debtor'
import ExternalIdentifier from '#modules/precatorios/models/external_identifier'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SiopImport from '#modules/siop/models/siop_import'
import SiopStagingRow from '#modules/siop/models/siop_staging_row'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

const VALID_ROWS = [
  {
    external_id: 'SIOP-2024-0001',
    cnj: '0001234-94.2024.4.01.3400',
    devedor: 'União Federal / Ministério da Saúde',
    valor: 'R$ 1.234.567,89',
    exercicio: 2024,
    natureza: 'Alimentar',
  },
  {
    external_id: 'SIOP-2024-0002',
    cnj: '0000001-47.2010.4.03.6100',
    devedor: 'Instituto Nacional do Seguro Social - INSS',
    valor: '250.000,00',
    exercicio: 2024,
    natureza: 'Comum',
  },
]

test.group('SIOP import service', () => {
  test('imports valid SIOP rows into staging and domain tables idempotently', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()

    const firstRun = await siopImportService.importRows({
      tenantId: tenant.id,
      exerciseYear: 2024,
      rows: VALID_ROWS,
      source: {
        checksum: `siop-import-service-${tenant.id}`,
        originalFilename: 'siop-2024.xlsx',
      },
    })

    assert.deepEqual(firstRun.stats, {
      totalRows: 2,
      inserted: 2,
      updated: 0,
      skipped: 0,
      errors: 0,
    })
    assert.equal(firstRun.import.status, 'completed')
    assert.equal(await countRows(PrecatorioAsset.query().where('tenant_id', tenant.id)), 2)
    assert.equal(await countRows(Debtor.query().where('tenant_id', tenant.id)), 2)
    assert.equal(await countRows(SiopStagingRow.query().where('import_id', firstRun.import.id)), 2)

    const asset = await PrecatorioAsset.query()
      .where('tenant_id', tenant.id)
      .where('external_id', 'SIOP-2024-0001')
      .firstOrFail()
    const valuation = await AssetValuation.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    assert.equal(valuation.faceValue, '1234567.89')
    assert.equal(asset.currentScore, 100)
    assert.isNotNull(asset.currentScoreId)
    assert.equal(await countRows(AssetSourceLink.query().where('tenant_id', tenant.id)), 2)
    assert.equal(await countRows(ExternalIdentifier.query().where('tenant_id', tenant.id)), 4)

    const secondRun = await siopImportService.importRows({
      tenantId: tenant.id,
      exerciseYear: 2024,
      rows: VALID_ROWS,
      source: {
        checksum: `siop-import-service-${tenant.id}`,
        originalFilename: 'siop-2024.xlsx',
      },
    })

    assert.deepEqual(secondRun.stats, {
      totalRows: 2,
      inserted: 0,
      updated: 2,
      skipped: 0,
      errors: 0,
    })
    assert.equal(await countRows(PrecatorioAsset.query().where('tenant_id', tenant.id)), 2)
    assert.equal(await countRows(AssetEvent.query().where('tenant_id', tenant.id)), 2)
    assert.equal(await countRows(AssetSourceLink.query().where('tenant_id', tenant.id)), 2)
    assert.equal(await countRows(ExternalIdentifier.query().where('tenant_id', tenant.id)), 4)

    await cleanupTenantImportData(tenant)
  })

  test('keeps imported assets isolated by tenant', async ({ assert }) => {
    const tenantA = await TenantFactory.create()
    const tenantB = await TenantFactory.create()

    await siopImportService.importRows({
      tenantId: tenantA.id,
      exerciseYear: 2024,
      rows: VALID_ROWS,
      source: { checksum: `siop-tenant-a-${tenantA.id}` },
    })
    await siopImportService.importRows({
      tenantId: tenantB.id,
      exerciseYear: 2024,
      rows: VALID_ROWS,
      source: { checksum: `siop-tenant-b-${tenantB.id}` },
    })

    assert.equal(await countRows(PrecatorioAsset.query().where('tenant_id', tenantA.id)), 2)
    assert.equal(await countRows(PrecatorioAsset.query().where('tenant_id', tenantB.id)), 2)

    await cleanupTenantImportData(tenantA)
    await cleanupTenantImportData(tenantB)
  })

  test('marks rows with invalid required fields as partial import errors', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await siopImportService.importRows({
      tenantId: tenant.id,
      exerciseYear: 2024,
      rows: [
        VALID_ROWS[0],
        {
          external_id: 'SIOP-2024-BAD',
          cnj: '0001234-00.2024.4.01.3400',
          devedor: '',
          valor: 'sem valor',
        },
      ],
      source: { checksum: `siop-partial-${tenant.id}` },
    })

    assert.deepEqual(result.stats, {
      totalRows: 2,
      inserted: 1,
      updated: 0,
      skipped: 1,
      errors: 1,
    })
    assert.equal(result.import.status, 'partial')
    assert.equal(
      await countRows(
        SiopStagingRow.query()
          .where('import_id', result.import.id)
          .where('validation_status', 'invalid')
      ),
      1
    )

    await cleanupTenantImportData(tenant)
  })

  test('imports official SIOP open-data rows without CNJ numbers', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await siopImportService.importRows({
      tenantId: tenant.id,
      exerciseYear: 2024,
      rows: [
        {
          chave: '1116122',
          exercicio: '2024',
          codigo_do_tribunal: '12105',
          nome_do_tribunal: 'Tribunal Regional Federal da 4a. Região',
          tipo_de_despesa: '12',
          codigo_da_uo_executada: '33904',
          nome_da_uo_executada: 'Fundo do Regime Geral de Previdência Social',
          natureza_de_despesa: '33909100',
          tipo_de_causa: 'Aposentadoria por Tempo de Contribuição (Art. 55/6)',
          valor_original_do_precatorio: '401540,95',
          valor_atualizado: '454035,83505015308',
          tributario: 'Não',
          fundef: 'Não Fundef',
          anos_decorridos: '10',
          class_tempo: 'De 10 até 15 anos',
          class_tribunais: 'Justiça Federal',
          datainicio: '2025-04-01 00:00:00,000',
          datafim: '2026-02-01 00:00:00,000',
          indiceatualizacao: '1,0315237099479411',
          data_de_ajuizamento_da_acao_originaria: '2014-07-28 00:00:00,000',
          data_da_autuacao: '2024-08-07 00:00:00,000',
          faixavalor: 'Até R$ 1 milhão',
        },
      ],
      source: { checksum: `siop-open-data-official-${tenant.id}` },
    })

    assert.deepEqual(result.stats, {
      totalRows: 1,
      inserted: 1,
      updated: 0,
      skipped: 0,
      errors: 0,
    })

    const asset = await PrecatorioAsset.query()
      .where('tenant_id', tenant.id)
      .where('external_id', '1116122')
      .preload('court')
      .preload('budgetUnit')
      .firstOrFail()
    const debtor = await Debtor.findOrFail(asset.debtorId!)
    const valuation = await AssetValuation.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    const budgetFact = await AssetBudgetFact.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()

    assert.isNull(asset.cnjNumber)
    assert.equal(valuation.faceValue, '401540.95')
    assert.equal(valuation.estimatedUpdatedValue, '454035.83')
    assert.equal(asset.assetNumber, '1116122')
    assert.equal(asset.court.code, '12105')
    assert.equal(asset.court.name, 'Tribunal Regional Federal da 4a. Região')
    assert.equal(asset.court.courtClass, 'Justiça Federal')
    assert.equal(asset.budgetUnit.code, '33904')
    assert.equal(asset.budgetUnit.name, 'Fundo do Regime Geral de Previdência Social')
    assert.equal(budgetFact.causeType, 'Aposentadoria por Tempo de Contribuição (Art. 55/6)')
    assert.equal(budgetFact.natureExpenseCode, '33909100')
    assert.equal(budgetFact.valueRange, 'Até R$ 1 milhão')
    assert.equal(budgetFact.taxClaim, false)
    assert.equal(budgetFact.fundef, false)
    assert.equal(budgetFact.elapsedYears, 10)
    assert.equal(budgetFact.elapsedYearsClass, 'De 10 até 15 anos')
    assert.equal(asset.originFiledAt?.toISODate(), '2014-07-28')
    assert.equal(asset.autuatedAt?.toISODate(), '2024-08-07')
    assert.equal(valuation.baseDate?.toISODate(), '2026-02-01')
    assert.equal(valuation.correctionStartedAt?.toISODate(), '2025-04-01')
    assert.equal(valuation.correctionEndedAt?.toISODate(), '2026-02-01')
    assert.equal(valuation.correctionIndex, '1.0315237099479411')
    assert.equal(debtor.normalizedKey, 'FUNDO DO REGIME GERAL DE PREVIDENCIA SOCIAL')

    await cleanupTenantImportData(tenant)
  })

  test('skips an import that is already running', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const firstRun = await siopImportService.importRows({
      tenantId: tenant.id,
      exerciseYear: 2024,
      rows: VALID_ROWS,
      source: { checksum: `siop-running-${tenant.id}` },
    })

    firstRun.import.merge({ status: 'running' })
    await firstRun.import.save()

    const secondRun = await siopImportService.importRows({
      tenantId: tenant.id,
      exerciseYear: 2024,
      rows: VALID_ROWS,
      source: { checksum: `siop-running-${tenant.id}` },
    })

    assert.isTrue(secondRun.skipped)
    assert.equal(secondRun.reason, 'already_running')
    assert.deepEqual(secondRun.stats, {
      totalRows: 2,
      inserted: 0,
      updated: 0,
      skipped: 2,
      errors: 0,
    })
    assert.equal(await countRows(SiopStagingRow.query().where('import_id', firstRun.import.id)), 2)

    await cleanupTenantImportData(tenant)
  })

  test('processes pending CSV imports through the job handler', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const csv = Buffer.from(
      [
        'external_id;cnj;devedor;valor;exercicio;natureza',
        'SIOP-CSV-0001;0001234-94.2024.4.01.3400;União Federal;R$ 1.234,56;2024;Comum',
      ].join('\n')
    )

    const pending = await siopImportService.createPendingFileImport({
      tenantId: tenant.id,
      exerciseYear: 2024,
      buffer: csv,
      originalFilename: 'siop-2024.csv',
      mimeType: 'text/csv',
      fileSizeBytes: csv.byteLength,
    })

    assert.equal(pending.import.status, 'pending')

    const stats = await handleSiopImport({
      tenantId: tenant.id,
      importId: pending.import.id,
      requestId: 'siop-import-test',
      bullmqJobId: `siop-import-${tenant.id}-${pending.import.id}`,
      attempts: 1,
    })

    assert.deepEqual(stats, {
      totalRows: 1,
      inserted: 1,
      updated: 0,
      skipped: 0,
      errors: 0,
    })

    const processedImport = await SiopImport.findOrFail(pending.import.id)
    assert.equal(processedImport.status, 'completed')
    assert.equal(await countRows(PrecatorioAsset.query().where('tenant_id', tenant.id)), 1)

    const [jobRun] = await db
      .from('radar_job_runs')
      .where('tenant_id', tenant.id)
      .where('job_name', 'siop-import')
      .select('*')

    assert.equal(jobRun.status, 'completed')
    assert.equal(jobRun.metrics.inserted, 1)
    assert.equal(jobRun.metadata.requestId, 'siop-import-test')

    await cleanupTenantImportData(tenant)
  })
})

async function cleanupTenantImportData(tenant: Tenant) {
  const imports = await SiopImport.query().where('tenant_id', tenant.id).select('id')
  const importIds = imports.map((row) => row.id)
  const assets = await PrecatorioAsset.query().where('tenant_id', tenant.id).select('id')
  const assetIds = assets.map((row) => row.id)

  if (importIds.length > 0) {
    await SiopStagingRow.query().whereIn('import_id', importIds).delete()
  }

  if (assetIds.length > 0) {
    await AssetScore.query().whereIn('asset_id', assetIds).delete()
    await AssetEvent.query().whereIn('asset_id', assetIds).delete()
  }

  await db.from('radar_job_runs').where('tenant_id', tenant.id).delete()
  await PrecatorioAsset.query().where('tenant_id', tenant.id).delete()
  await Debtor.query().where('tenant_id', tenant.id).delete()
  await SiopImport.query().where('tenant_id', tenant.id).delete()
  await SourceRecord.query().where('tenant_id', tenant.id).delete()
  await tenant.delete()
}

async function countRows<Model extends LucidModel>(
  query: ModelQueryBuilderContract<Model, InstanceType<Model> & LucidRow>
) {
  const [result] = await query.count('* as total')
  return Number(result.$extras.total)
}
