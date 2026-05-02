import { mkdir, rm, writeFile } from 'node:fs/promises'
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SourceDataset from '#modules/integrations/models/source_dataset'
import tjbaPrecatorioImportService from '#modules/integrations/services/tjba_precatorio_import_service'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

test.group('TJBA precatorio import service', () => {
  test('imports TJBA API rows into canonical precatorio records idempotently', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createSourceRecord(tenant)

    const result = await tjbaPrecatorioImportService.importSourceRecord(sourceRecord.id)

    assert.deepEqual(result.stats, {
      totalRows: 2,
      validRows: 2,
      selectedRows: 2,
      inserted: 2,
      updated: 0,
      skipped: 0,
      errors: 0,
    })

    const asset = await PrecatorioAsset.query()
      .where('tenant_id', tenant.id)
      .where('external_id', 'tjba:0013000-04.2013.805.0000-0')
      .firstOrFail()
    assert.equal(asset.cnjNumber, '0013000-04.2013.8.05.0000')
    assert.equal(asset.nature, 'alimentar')
    assert.equal(asset.exerciseYear, 2015)
    assert.equal(asset.piiStatus, 'materialized')

    const debtor = await asset.related('debtor').query().firstOrFail()
    assert.equal(debtor.name, 'A FAZENDA PUBLICA DO ESTADO DA BAHIA')
    assert.equal(debtor.stateCode, 'BA')
    assert.equal(debtor.debtorType, 'state')

    const valuation = await AssetValuation.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    assert.equal(valuation.faceValue, '67461.05')
    assert.equal(valuation.queuePosition, 1)

    const secondRun = await tjbaPrecatorioImportService.importSourceRecord(sourceRecord.id)
    assert.equal(secondRun.stats.inserted, 0)
    assert.equal(secondRun.stats.updated, 2)

    await tenant.delete()
    await rm(app.makePath('storage', 'tribunal', 'tjba', tenant.id), {
      recursive: true,
      force: true,
    })
  })
})

async function createSourceRecord(tenant: Tenant) {
  const dataset = await SourceDataset.findByOrFail('key', 'court-annual-map-pages')
  const directory = app.makePath('storage', 'tribunal', 'tjba', tenant.id)
  const filePath = app.makePath('storage', 'tribunal', 'tjba', tenant.id, 'tjba-test-page.json')
  const payload = {
    content: [
      {
        cdEntidade: null,
        deEntidade: null,
        tipoRegime: null,
        listaPrecatorio: [
          {
            cdPrecatorio: '0013000-04.2013.805.0000-0',
            cdEntidadeDevedora: 2,
            deEntidadeDevedora: null,
            nuAnoOrcamento: 2015,
            cdNatureza: 'A',
            dtExpedicao: [2013, 7, 23],
            deUnidadeRequisitante: '69352166',
            deBeneficiario: 'ADILSON JOSE DA SILVA SOUZA',
            valorDevido: 67461.05,
            dataExp: '23/07/2013',
            hora: '13:14:28',
            siglaTipo: 'PD',
            siglaCdNatureza: 'C',
            ordemCronologica: 1,
            flprioridade: 1,
            flnormal: 0,
            flagPrioridade: true,
            valor: '67.461,05',
          },
          {
            cdPrecatorio: '0001580-94.2016.805.0000-0',
            cdEntidadeDevedora: 2,
            deEntidadeDevedora: null,
            nuAnoOrcamento: 2017,
            cdNatureza: 'C',
            dtExpedicao: [2016, 1, 29],
            deUnidadeRequisitante: '69352166',
            deBeneficiario: null,
            valorDevido: 150000,
            dataExp: '29/01/2016',
            ordemCronologica: 2,
            flprioridade: 0,
            flnormal: 1,
            flagPrioridade: false,
            valor: '150.000,00',
          },
        ],
      },
    ],
    totalElements: 2,
    totalPages: 1,
    number: 1,
    size: 2,
    numberOfElements: 2,
    empty: false,
  }

  await mkdir(directory, { recursive: true })
  await writeFile(filePath, JSON.stringify(payload), { flag: 'w' })

  return SourceRecord.create({
    tenantId: tenant.id,
    sourceDatasetId: dataset.id,
    source: 'tribunal',
    sourceUrl:
      'https://listaprecatoriosws.tjba.jus.br/api/entidade-devedora/precatorios?page=1&size=2',
    sourceFilePath: filePath,
    sourceChecksum: `tjba-import-test-${tenant.id}`,
    originalFilename: 'tjba-test-page.json',
    mimeType: 'application/json',
    fileSizeBytes: 1,
    collectedAt: DateTime.now(),
    rawData: {
      providerId: 'tjba-precatorio-api',
      courtAlias: 'tjba',
      debtorNamesByCode: {
        '2': 'A FAZENDA PUBLICA DO ESTADO DA BAHIA',
      },
    },
  })
}
