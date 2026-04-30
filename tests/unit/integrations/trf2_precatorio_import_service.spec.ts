import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import trf2PrecatorioImportService from '#modules/integrations/services/trf2_precatorio_import_service'
import AssetEvent from '#modules/precatorios/models/asset_event'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import Publication from '#modules/precatorios/models/publication'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const TRF2_CSV = `
Notas explicativas:;;;;;;;;;;;
;;;;;;;;;;;
Nº de Ordem Cronológica; Proposta; Base legal para enquadramento na ordem cronológica; Número do Precatório; CPF/CNPJ parcial do beneficiário; Data de Autuação no TRF2; Atualizado Até; Parcela Devida; Valor Original Pago; Data Pagamento; Valor Pago;
1;2024;Alimentares, Art. 107 A, 8, Inciso II;5004648-37.2022.4.02.9388;109********;15/04/2022 19:05;abr/23;110.649,95;110.649,95;dez/23;113.128,50;
2;2024;Alimentares, Art. 107 A, 8, Inciso II;5004648-37.2022.4.02.9388;773********;15/04/2022 19:05;abr/23;45.443,75;45.443,75;dez/23;46.461,69;
3;2024;Comuns;5004649-22.2022.4.02.9388;420********;16/04/2022 16:49;abr/23;10.000,00;10.000,00;dez/23;10.500,00;
`

test.group('TRF2 precatorio import service', () => {
  test('consolidates TRF2 rows by CNJ into assets, processes, publications, and events', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createSourceRecord(tenant, TRF2_CSV)

    const result = await trf2PrecatorioImportService.importSourceRecord(sourceRecord.id)

    assert.deepEqual(result.stats, {
      totalRows: 3,
      validRows: 3,
      groupedPrecatorios: 2,
      inserted: 2,
      updated: 0,
      skipped: 0,
      errors: 0,
    })

    const asset = await PrecatorioAsset.query()
      .where('tenant_id', tenant.id)
      .where('cnj_number', '5004648-37.2022.4.02.9388')
      .firstOrFail()

    assert.equal(asset.source, 'tribunal')
    assert.equal(asset.faceValue, '156093.70')
    assert.equal(asset.estimatedUpdatedValue, '159590.19')
    assert.equal(asset.lifecycleStatus, 'paid')
    assert.equal(asset.piiStatus, 'pseudonymous')
    assert.deepEqual(asset.rawData?.beneficiaryDocumentMasks, ['109********', '773********'])

    assert.equal(await countRows(JudicialProcess, tenant.id), 2)
    assert.equal(await countRows(Publication, tenant.id), 2)
    assert.equal(await countRows(AssetEvent, tenant.id), 2)

    const secondRun = await trf2PrecatorioImportService.importSourceRecord(sourceRecord.id)
    assert.equal(secondRun.stats.inserted, 0)
    assert.equal(secondRun.stats.updated, 2)
    assert.equal(await countRows(PrecatorioAsset, tenant.id), 2)
    assert.equal(await countRows(Publication, tenant.id), 2)
    assert.equal(await countRows(AssetEvent, tenant.id), 2)

    await cleanupTenantData(tenant)
  })
})

async function createSourceRecord(tenant: Tenant, contents: string) {
  const directory = app.makePath('storage', 'tribunal', 'trf2', tenant.id)
  const filePath = join(directory, 'test-trf2.csv')

  await mkdir(directory, { recursive: true })
  await writeFile(filePath, Buffer.from(contents, 'latin1'))

  return SourceRecord.create({
    tenantId: tenant.id,
    source: 'tribunal',
    sourceUrl:
      'https://static.trf2.jus.br/nas-internet/documento/consultas/precatorios/divida/2024/lista-ordem-cronologica-pagamento-precatorios-2024.csv',
    sourceFilePath: filePath,
    sourceChecksum: `trf2-import-test-${tenant.id}`,
    originalFilename: 'lista-ordem-cronologica-pagamento-precatorios-2024.csv',
    mimeType: 'text/csv',
    fileSizeBytes: contents.length,
    collectedAt: DateTime.now(),
    rawData: {
      providerId: 'trf2-precatorios',
      courtAlias: 'trf2',
      sourceKind: 'paid_precatorios',
      year: 2024,
    },
  })
}

async function countRows(
  model: typeof PrecatorioAsset | typeof JudicialProcess | typeof Publication | typeof AssetEvent,
  tenantId: string
) {
  const [result] = await model.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}

async function cleanupTenantData(tenant: Tenant) {
  await rm(app.makePath('storage', 'tribunal', 'trf2', tenant.id), {
    recursive: true,
    force: true,
  })
  await tenant.delete()
}
