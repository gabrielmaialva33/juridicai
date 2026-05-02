import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import trf3PrecatorioImportService from '#modules/integrations/services/trf3_precatorio_import_service'
import TribunalBudgetExecution from '#modules/integrations/models/tribunal_budget_execution'
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

const TRF3_ANEXO_II_CSV = [
  'PODER JUDICIÁRIO;;;;;;;;;;;;;;;;;;;;;;;;',
  'Data de referência:;janeiro-26;;;;;;;;;;;;;;;;;;;;;;;',
  'Classificação Orçamentária;;;;;;;;;;Dotação Inicial;Créditos Adicionais;;Dotação Atualizada;Contingenciado;Movimentação Líquida de Créditos;;Dotação Líquida;Execução;;;;;;',
  'Unidade Orçamentária;;Função e Subfunção;Programática;Descrição ;;Esfera;Fonte;;GND;;Acréscimos;Decréscimos;;;Provisão;Destaque;;Empenhado;%;Liquidado;%; Pago ;%',
  'Código;Descrição;;;Programa;Ação e Subtítulo;;Código;Descrição;;A;B;C;D=A+B-C;E;F;G;H = D-E+F+G;I;I / H;J;J / H; K ;K / H',
  '33904;FUNDO DO REGIME GERAL DA PREVIDENCIA SOCIAL;28.846;0901.0625;OPERACOES ESPECIAIS: CUMPRIMENTO DE SENTENCAS JUDICIAIS;SENTENCAS JUDICIAIS TRANSITADAS EM JULGADO DE PEQUENO VALOR;2;1002;ATIVIDADES-FIM DA SEGURIDADE SOCIAL;3;;;; - ; - ; 51.152.493 ; - ; 51.152.493 ; 51.070.572 ;99,8%; 51.070.572 ;99,8%; 51.070.572 ;99,8%',
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
      budgetExecutionInserted: 0,
      budgetExecutionUpdated: 0,
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

  test('imports TRF3 Anexo II budget execution rows without creating assets', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createAnexoIiSourceRecord(tenant)

    const result = await trf3PrecatorioImportService.importSourceRecord(sourceRecord.id)

    assert.equal(result.extraction.format, 'csv')
    assert.deepEqual(result.stats, {
      totalRows: 5,
      validRows: 0,
      selectedRows: 0,
      inserted: 0,
      updated: 0,
      skipped: 5,
      errors: 0,
      budgetExecutionInserted: 1,
      budgetExecutionUpdated: 0,
    })

    const execution = await TribunalBudgetExecution.query()
      .where('tenant_id', tenant.id)
      .where('source_record_id', sourceRecord.id)
      .firstOrFail()

    assert.equal(execution.courtAlias, 'trf3')
    assert.equal(execution.referenceYear, 2026)
    assert.equal(execution.referenceMonth, 1)
    assert.equal(execution.budgetUnitCode, '33904')
    assert.equal(execution.budgetUnitName, 'FUNDO DO REGIME GERAL DA PREVIDENCIA SOCIAL')
    assert.equal(execution.netAllocation, '51152493.00')
    assert.equal(execution.committedAmount, '51070572.00')
    assert.equal(execution.committedPercent, '0.9980')
    assert.equal(execution.paidAmount, '51070572.00')

    assert.equal(await countRows(PrecatorioAsset, tenant.id), 0)
    assert.equal(await countRows(TribunalBudgetExecution, tenant.id), 1)

    const secondRun = await trf3PrecatorioImportService.importSourceRecord(sourceRecord.id)
    assert.equal(secondRun.stats.budgetExecutionInserted, 0)
    assert.equal(secondRun.stats.budgetExecutionUpdated, 1)
    assert.equal(await countRows(TribunalBudgetExecution, tenant.id), 1)

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

async function createAnexoIiSourceRecord(tenant: Tenant) {
  const directory = app.makePath('storage', 'tribunal', 'trf3', tenant.id)
  const filePath = join(directory, 'trf3-anexo-ii-2026-01.csv')

  await mkdir(directory, { recursive: true })
  await writeFile(filePath, TRF3_ANEXO_II_CSV)

  return SourceRecord.create({
    tenantId: tenant.id,
    source: 'tribunal',
    sourceUrl:
      'https://www.trf3.jus.br/documentos/upla/res-102-anexo-ii/tribunal-regional-federal-da-3-regiao-precatorio-rpv/2026/2026-01.csv',
    sourceFilePath: filePath,
    sourceChecksum: `trf3-anexo-ii-import-test-${tenant.id}`,
    originalFilename: '2026-01.csv',
    mimeType: 'text/csv',
    fileSizeBytes: Buffer.byteLength(TRF3_ANEXO_II_CSV),
    collectedAt: DateTime.now(),
    rawData: {
      providerId: 'trf3-cnj-102-precatorios-rpv',
      courtAlias: 'trf3',
      sourceKind: 'cnj_102_monthly_report',
      year: 2026,
      month: 1,
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
    | typeof ExternalIdentifier
    | typeof TribunalBudgetExecution,
  tenantId: string
) {
  const [result] = await model.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}
