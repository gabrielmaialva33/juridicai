import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import ExternalIdentifier from '#modules/precatorios/models/external_identifier'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import genericTribunalPrecatorioImportService from '#modules/integrations/services/generic_tribunal_precatorio_import_service'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const CNJ_NUMBER = '0013000-04.2013.8.05.0000'

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

  test('materializes structured TJMA queue fields into canonical assets', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createTjmaSourceRecord(tenant)

    const result = await genericTribunalPrecatorioImportService.importSourceRecord(
      sourceRecord.id,
      {
        pdfTextExtractor: async () => `
        Lista de Ordem Cronológica do Estado do Maranhão
        Atualizada até 28/02/2026
        ESTADO DO MARANHÃO (Administração Direta e Indireta) REGIME ESPECIAL
        Ordem Nº Precatório Natureza Orç. Recebimento Prioridade Valor atualizado Ente
        1 0806816-09.2023.8.10.0000 Alimentar 2024 30/03/2023 17:24:19 Doença Grave 135.803,94 ESTADO
      `,
      }
    )

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
      .where('cnj_number', '0806816-09.2023.8.10.0000')
      .firstOrFail()

    assert.equal(asset.nature, 'alimentar')
    assert.equal(asset.exerciseYear, 2024)
    assert.equal(asset.budgetYear, 2024)
    assert.equal(asset.originFiledAt?.toISODate(), '2023-03-30')

    const debtor = await asset.related('debtor').query().firstOrFail()
    assert.equal(debtor.name, 'Estado do Maranhão')
    assert.equal(debtor.debtorType, 'state')
    assert.equal(debtor.paymentRegime, 'special')

    const valuation = await AssetValuation.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    assert.equal(valuation.faceValue, '135803.94')
    assert.equal(valuation.queuePosition, 1)

    const event = await AssetEvent.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .where('event_type', 'superpreference_granted')
      .firstOrFail()
    assert.equal(event.payload?.preferenceLabel, 'Doença Grave')
    assert.equal(event.payload?.queuePosition, 1)

    const queueSignal = await AssetEvent.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .where('event_type', 'queue_position_favorable')
      .firstOrFail()
    assert.equal(queueSignal.payload?.queuePosition, 1)
    assert.equal(queueSignal.payload?.sourceKind, 'chronological_list')

    const chronologicalOrder = await ExternalIdentifier.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .where('identifier_type', 'chronological_order')
      .firstOrFail()
    assert.equal(chronologicalOrder.identifierValue, '1')

    const secondRun = await genericTribunalPrecatorioImportService.importSourceRecord(
      sourceRecord.id,
      {
        pdfTextExtractor: async () => `
          Lista de Ordem Cronológica do Estado do Maranhão
          Atualizada até 28/02/2026
          ESTADO DO MARANHÃO (Administração Direta e Indireta) REGIME ESPECIAL
          Ordem Nº Precatório Natureza Orç. Recebimento Prioridade Valor atualizado Ente
          1 0806816-09.2023.8.10.0000 Alimentar 2024 30/03/2023 17:24:19 Doença Grave 135.803,94 ESTADO
        `,
      }
    )
    assert.equal(secondRun.stats.inserted, 0)
    assert.equal(secondRun.stats.updated, 1)
    assert.equal(
      await AssetEvent.query()
        .where('tenant_id', tenant.id)
        .where('asset_id', asset.id)
        .where('event_type', 'superpreference_granted')
        .count('* as total')
        .then(([row]) => Number(row.$extras.total)),
      1
    )
    assert.equal(
      await AssetEvent.query()
        .where('tenant_id', tenant.id)
        .where('asset_id', asset.id)
        .where('event_type', 'queue_position_favorable')
        .count('* as total')
        .then(([row]) => Number(row.$extras.total)),
      1
    )

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

async function createTjmaSourceRecord(tenant: Tenant) {
  const directory = app.makePath('storage', 'tests', 'generic-tribunal-import', tenant.id)
  const filePath = join(directory, 'tjma-lista.pdf')

  await mkdir(directory, { recursive: true })
  await writeFile(filePath, '%PDF fixture')

  return SourceRecord.create({
    tenantId: tenant.id,
    source: 'tribunal',
    sourceUrl: 'https://example.test/tjma-lista.pdf',
    sourceFilePath: filePath,
    sourceChecksum: `generic-tribunal-import-tjma-${tenant.id}`,
    originalFilename: 'tjma-lista.pdf',
    mimeType: 'application/pdf',
    collectedAt: DateTime.now(),
    rawData: {
      providerId: 'tjma-precatorio-reports',
      targetKey: 'court-map:tjma',
      courtAlias: 'tjma',
      stateCode: 'MA',
      sourceKind: 'chronological_list',
      debtorGroup: 'state',
      title: 'Lista de Ordem Cronológica do Estado do Maranhão',
    },
  })
}
