import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import AssetBudgetFact from '#modules/precatorios/models/asset_budget_fact'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetSourceLink from '#modules/precatorios/models/asset_source_link'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import ExternalIdentifier from '#modules/precatorios/models/external_identifier'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SourceRecord from '#modules/siop/models/source_record'
import tjspPrecatorioDocumentImportService from '#modules/integrations/services/tjsp_precatorio_document_import_service'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const VALID_CNJ = '0001234-94.2024.4.01.3400'

test.group('TJSP precatorio document import service', () => {
  test('imports extracted TJSP document rows into canonical assets idempotently', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createTjspDocumentSourceRecord(tenant)

    const firstRun = await tjspPrecatorioDocumentImportService.importSourceRecord(sourceRecord.id)
    const secondRun = await tjspPrecatorioDocumentImportService.importSourceRecord(sourceRecord.id)

    assert.deepInclude(firstRun.stats, {
      extractedRows: 1,
      importableRows: 1,
      inserted: 1,
      updated: 0,
      skipped: 0,
      errors: 0,
    })
    assert.deepInclude(secondRun.stats, {
      extractedRows: 1,
      importableRows: 1,
      inserted: 0,
      updated: 1,
      skipped: 0,
      errors: 0,
    })

    const asset = await PrecatorioAsset.query()
      .where('tenant_id', tenant.id)
      .where('source', 'tribunal')
      .preload('debtor')
      .preload('court')
      .firstOrFail()
    const valuation = await AssetValuation.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    const budgetFact = await AssetBudgetFact.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    const process = await JudicialProcess.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    const events = await AssetEvent.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
    const links = await AssetSourceLink.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
    const identifiers = await ExternalIdentifier.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .orderBy('identifier_type', 'asc')

    assert.equal(asset.externalId, `tjsp:${VALID_CNJ}`)
    assert.equal(asset.cnjNumber, VALID_CNJ)
    assert.equal(asset.exerciseYear, 2024)
    assert.equal(asset.nature, 'alimentar')
    assert.equal(asset.lifecycleStatus, 'discovered')
    assert.equal(asset.complianceStatus, 'approved_for_analysis')
    assert.equal(asset.debtor.name, 'Município de Santos')
    assert.equal(asset.debtor.debtorType, 'municipality')
    assert.equal(asset.debtor.paymentRegime, 'special')
    assert.equal(asset.court.code, 'TJSP')
    assert.equal(valuation.faceValue, '123456.78')
    assert.equal(valuation.queuePosition, 7)
    assert.equal(budgetFact.budgetYear, 2024)
    assert.equal(process.cnjNumber, VALID_CNJ)
    assert.equal(process.courtAlias, 'tjsp')
    assert.lengthOf(events, 1)
    assert.equal(events[0].eventType, 'tjsp_document_imported')
    assert.lengthOf(links, 1)
    assert.equal(links[0].linkType, 'primary')
    assert.deepEqual(
      identifiers.map((identifier) => identifier.identifierType),
      ['cnj_number', 'source_external_id']
    )
    assert.equal(await countAssets(tenant.id), 1)
    assert.equal(await countValuations(tenant.id), 1)
    assert.equal(await countBudgetFacts(tenant.id), 1)
    assert.equal(await countEvents(tenant.id), 1)

    await cleanupTenantData(tenant)
  })

  test('imports rows without CNJ using a stable source external id', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createTjspDocumentSourceRecord(
      tenant,
      ['Entidade;Valor;Ano', 'Instituto de Previdência Municipal;R$ 9.000,00;2025'].join('\n')
    )

    const result = await tjspPrecatorioDocumentImportService.importSourceRecord(sourceRecord.id)
    const asset = await PrecatorioAsset.query()
      .where('tenant_id', tenant.id)
      .where('source', 'tribunal')
      .firstOrFail()
    const identifiers = await ExternalIdentifier.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)

    assert.equal(result.stats.inserted, 1)
    assert.isNull(asset.cnjNumber)
    assert.match(asset.externalId ?? '', new RegExp(`^tjsp:${sourceRecord.id}:`))
    assert.equal(asset.nature, 'unknown')
    assert.equal(asset.exerciseYear, 2025)
    assert.deepEqual(
      identifiers.map((identifier) => identifier.identifierType),
      ['source_external_id']
    )

    await cleanupTenantData(tenant)
  })
})

async function createTjspDocumentSourceRecord(
  tenant: Tenant,
  contents = [
    'Ordem;Processo;Entidade;Natureza;Valor;Ano',
    `7;${VALID_CNJ};Município de Santos;Alimentar;R$ 123.456,78;2024`,
  ].join('\n')
) {
  const directory = app.makePath('storage', 'tests', 'tjsp-document-import', tenant.id)
  const filePath = join(directory, 'tjsp-list.csv')

  await mkdir(directory, { recursive: true })
  await writeFile(filePath, contents)

  return SourceRecord.create({
    tenantId: tenant.id,
    source: 'tribunal',
    sourceUrl: 'https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=61711',
    sourceFilePath: filePath,
    originalFilename: 'tjsp-list.csv',
    mimeType: 'text/csv',
    sourceChecksum: `tjsp-document-${tenant.id}-${contents.length}`,
    collectedAt: DateTime.now(),
    rawData: {
      providerId: 'tjsp-precatorio-communications',
      recordKind: 'attached_document',
      category: 'municipal_entities',
      communicationCode: '6148',
      externalCode: '61711',
      title: 'Lista geral de precatórios',
    },
  })
}

async function cleanupTenantData(tenant: Tenant) {
  await tenant.delete()
  await rm(app.makePath('storage', 'tests', 'tjsp-document-import', tenant.id), {
    recursive: true,
    force: true,
  })
}

async function countAssets(tenantId: string) {
  const [result] = await PrecatorioAsset.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}

async function countValuations(tenantId: string) {
  const [result] = await AssetValuation.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}

async function countBudgetFacts(tenantId: string) {
  const [result] = await AssetBudgetFact.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}

async function countEvents(tenantId: string) {
  const [result] = await AssetEvent.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}
