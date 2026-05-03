import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import trf1PrecatorioImportService from '#modules/integrations/services/trf1_precatorio_import_service'
import AssetBudgetFact from '#modules/precatorios/models/asset_budget_fact'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetSourceLink from '#modules/precatorios/models/asset_source_link'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import Debtor from '#modules/debtors/models/debtor'
import ExternalIdentifier from '#modules/precatorios/models/external_identifier'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const TRF1_CSV = [
  'Ordem;Processo;Natureza do Crédito;Entidade Devedora;Valor Atualizado;Exercício;Data de Apresentação;Requisição;Unidade Orçamentária;Assunto',
  '1;0001234-94.2024.4.01.3400;Alimentar;Município de Belo Horizonte MG;987.654,32;2026;12/04/2025;REQ-TRF1-1;Município de Belo Horizonte;Servidor público',
  '2;SEM PROCESSO;Comum;Estado do Amazonas AM;120.000,00;2026;13/04/2025;REQ-TRF1-2;Estado do Amazonas;Saúde',
].join('\n')

const TRF1_EXCEL_HTML = `
<table>
  <tr><td colspan="7">RELAÇÃO DE PRECATÓRIOS DOS DEVEDORES ESTADUAIS</td></tr>
  <tr>
    <td>PROPOSTA</td>
    <td>PRECATÓRIO</td>
    <td>NATUREZA</td>
    <td>PREFERÊNCIA</td>
    <td>DATA DA APRESENTAÇÃO</td>
    <td>VALOR DEVIDO EM 04/2025 (R$)</td>
    <td>DEVEDOR</td>
  </tr>
  <tr>
    <td>2026</td>
    <td>054421-49.2025.4.01.9198</td>
    <td>Comum</td>
    <td>Não</td>
    <td>19/02/2025</td>
    <td>388.197,55</td>
    <td>ESTADO DO ACRE - AC</td>
  </tr>
  <tr>
    <td>2026</td>
    <td>402660-45.2024.4.01.9198</td>
    <td>Comum</td>
    <td>Não</td>
    <td>08/07/2024</td>
    <td>452.053,94</td>
    <td>MUNICIPIO DE CAPIXABA - AC</td>
  </tr>
</table>
`

test.group('TRF1 precatorio import service', () => {
  test('imports TRF1 report rows into canonical assets and evidence', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createSourceRecord(tenant)

    const result = await trf1PrecatorioImportService.importSourceRecord(sourceRecord.id, {
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
      .where('cnj_number', '0001234-94.2024.4.01.3400')
      .firstOrFail()

    assert.equal(asset.source, 'tribunal')
    assert.include(asset.externalId ?? '', 'trf1:subnational_repasses:2026')
    assert.equal(asset.assetNumber, '0001234-94.2024.4.01.3400')
    assert.equal(asset.exerciseYear, 2026)
    assert.equal(asset.nature, 'alimentar')
    assert.equal(asset.lifecycleStatus, 'paid')

    const debtor = await Debtor.findOrFail(asset.debtorId!)
    assert.equal(debtor.debtorType, 'municipality')
    assert.equal(debtor.stateCode, 'MG')

    const valuation = await AssetValuation.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    assert.equal(valuation.estimatedUpdatedValue, '987654.32')
    assert.equal(valuation.queuePosition, 1)

    const budgetFact = await AssetBudgetFact.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    assert.equal(budgetFact.causeType, 'Servidor público')

    assert.equal(await countRows(PrecatorioAsset, tenant.id), 1)
    assert.equal(await countRows(AssetValuation, tenant.id), 1)
    assert.equal(await countRows(AssetBudgetFact, tenant.id), 1)
    assert.equal(await countRows(JudicialProcess, tenant.id), 1)
    assert.equal(await countRows(AssetEvent, tenant.id), 1)
    assert.equal(await countRows(AssetSourceLink, tenant.id), 1)
    assert.equal(await countRows(ExternalIdentifier, tenant.id), 3)

    const secondRun = await trf1PrecatorioImportService.importSourceRecord(sourceRecord.id, {
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

  test('imports TRF1 Excel HTML rows with shortened process numbers from official reports', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createHtmlSourceRecord(tenant)

    const result = await trf1PrecatorioImportService.importSourceRecord(sourceRecord.id, {
      maxRows: 2,
      chunkSize: 1,
    })

    assert.equal(result.extraction.format, 'html')
    assert.deepEqual(result.stats, {
      totalRows: 2,
      validRows: 2,
      selectedRows: 2,
      inserted: 2,
      updated: 0,
      skipped: 0,
      errors: 0,
    })

    const acreAsset = await PrecatorioAsset.query()
      .where('tenant_id', tenant.id)
      .where('asset_number', '054421-49.2025.4.01.9198')
      .firstOrFail()
    assert.equal(acreAsset.lifecycleStatus, 'discovered')
    assert.equal(acreAsset.exerciseYear, 2026)

    const valuation = await AssetValuation.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', acreAsset.id)
      .firstOrFail()
    assert.equal(valuation.estimatedUpdatedValue, '388197.55')

    const debtors = await Debtor.query().where('tenant_id', tenant.id).orderBy('name', 'asc')
    assert.deepEqual(
      debtors.map((debtor) => [debtor.name, debtor.debtorType, debtor.stateCode]),
      [
        ['ESTADO DO ACRE - AC', 'state', 'AC'],
        ['MUNICIPIO DE CAPIXABA - AC', 'municipality', 'AC'],
      ]
    )

    assert.equal(await countRows(PrecatorioAsset, tenant.id), 2)
    assert.equal(await countRows(AssetSourceLink, tenant.id), 2)

    await cleanupTenantData(tenant)
  })
})

async function createSourceRecord(tenant: Tenant) {
  const directory = app.makePath('storage', 'tribunal', 'trf1', tenant.id)
  const filePath = join(directory, 'trf1-subnational-repasses-2026.csv')

  await mkdir(directory, { recursive: true })
  await writeFile(filePath, TRF1_CSV)

  return SourceRecord.create({
    tenantId: tenant.id,
    source: 'tribunal',
    sourceUrl: 'https://www.trf1.jus.br/conteudo/files/repasses-2026.csv',
    sourceFilePath: filePath,
    sourceChecksum: `trf1-import-test-${tenant.id}`,
    originalFilename: 'repasses-2026.csv',
    mimeType: 'text/csv',
    fileSizeBytes: Buffer.byteLength(TRF1_CSV),
    collectedAt: DateTime.now(),
    rawData: {
      providerId: 'trf1-precatorio-reports',
      courtAlias: 'trf1',
      sourceKind: 'subnational_repasses',
      title: 'Repasses Entidades Devedoras Estaduais e Municipais de 2026',
      year: 2026,
      pathId: 'repasses-2026',
    },
  })
}

async function createHtmlSourceRecord(tenant: Tenant) {
  const directory = app.makePath('storage', 'tribunal', 'trf1', tenant.id)
  const filePath = join(directory, 'trf1-subnational-proposal-2026.htm')

  await mkdir(directory, { recursive: true })
  await writeFile(filePath, TRF1_EXCEL_HTML)

  return SourceRecord.create({
    tenantId: tenant.id,
    source: 'tribunal',
    sourceUrl: 'https://www.trf1.jus.br/trf1/conteudo/relacao-precatorios-2026.htm',
    sourceFilePath: filePath,
    sourceChecksum: `trf1-html-import-test-${tenant.id}`,
    originalFilename: 'trf1-subnational-proposal-2026.htm',
    mimeType: 'text/html',
    fileSizeBytes: Buffer.byteLength(TRF1_EXCEL_HTML),
    collectedAt: DateTime.now(),
    rawData: {
      providerId: 'trf1-precatorio-reports',
      courtAlias: 'trf1',
      sourceKind: 'subnational_budget_proposal',
      title: 'Proposta de 2026',
      year: 2026,
      pathId: 'relacao-precatorios-2026',
    },
  })
}

async function cleanupTenantData(tenant: Tenant) {
  await SourceRecord.query().where('tenant_id', tenant.id).delete()
  await rm(app.makePath('storage', 'tribunal', 'trf1', tenant.id), {
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
