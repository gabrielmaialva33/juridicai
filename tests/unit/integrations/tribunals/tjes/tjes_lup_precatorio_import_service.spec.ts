import { mkdir, rm, writeFile } from 'node:fs/promises'
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SourceDataset from '#modules/integrations/models/source_dataset'
import tjesLupPrecatorioImportService from '#modules/integrations/services/tjes_lup_precatorio_import_service'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

test.group('TJES LUP precatorio import service', () => {
  test('imports TJES LUP rows into canonical precatorio records idempotently', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createSourceRecord(tenant)

    const result = await tjesLupPrecatorioImportService.importSourceRecord(sourceRecord.id)

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
      .where('external_id', 'tjes-lup:2259:00036528920248080000')
      .firstOrFail()
    assert.equal(asset.cnjNumber, '0003652-89.2024.8.08.0000')
    assert.equal(asset.originProcessNumber, '5023184-57.2022.8.08.0024')
    assert.equal(asset.nature, 'alimentar')
    assert.equal(asset.exerciseYear, 2026)
    assert.equal(asset.piiStatus, 'materialized')

    const debtor = await asset.related('debtor').query().firstOrFail()
    assert.equal(debtor.name, 'ESTADO DO ESPÍRITO SANTO')
    assert.equal(debtor.stateCode, 'ES')
    assert.equal(debtor.debtorType, 'state')
    assert.equal(debtor.paymentRegime, 'none')

    const valuation = await AssetValuation.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    assert.equal(valuation.faceValue, '65481.86')
    assert.equal(valuation.queuePosition, 1)

    const secondRun = await tjesLupPrecatorioImportService.importSourceRecord(sourceRecord.id)
    assert.equal(secondRun.stats.inserted, 0)
    assert.equal(secondRun.stats.updated, 2)

    await tenant.delete()
    await rm(app.makePath('storage', 'tribunal', 'tjes', tenant.id), {
      recursive: true,
      force: true,
    })
  })
})

async function createSourceRecord(tenant: Tenant) {
  const dataset = await SourceDataset.findByOrFail('key', 'court-annual-map-pages')
  const directory = app.makePath('storage', 'tribunal', 'tjes', tenant.id)
  const filePath = app.makePath('storage', 'tribunal', 'tjes', tenant.id, 'tjes-test-page.json')
  const payload = {
    total: 2,
    valor_total: 130963.72,
    results: [
      {
        ordem: 1,
        cd_precatorio: '00036528920248080000',
        cd_precatorio_original: '00036528920248080000',
        cd_tribunal: 8,
        dt_importacao: '2026-03-24T17:02:29',
        nu_ano_orcamento: 2026,
        dt_decisao: '2022-09-23T00:00:00',
        dt_expedicao: '2024-11-08T15:10:04',
        cd_natureza: 'A',
        nu_acao: '50231845720228080024',
        de_unidade_requisitante: null,
        dt_atualizacao: '2026-02-28T00:00:00',
        de_entidade_devedora: 'ESTADO DO ESPÍRITO SANTO',
        vl_atualizado: 65481.86,
        cd_entidade_devedora: 2259,
        vl_fim_exercicio: 0,
        vl_prioritario_doenca: 65481.86,
        vl_prioritario_idade: 0,
        fl_eh_ultima_importacao: 'S',
        de_beneficiario: 'SILVIA ANGELA CARNEIRO DA SILVA',
        dt_disponibilizacao: '2026-03-24T17:02:29',
        fl_nao_baixado: 'N',
        cd_exportacao: 227,
        is_prioritario_doenca: true,
        is_prioritario_idade: false,
      },
      {
        ordem: 2,
        cd_precatorio: '00037186920248080000',
        cd_precatorio_original: '00037186920248080000',
        cd_tribunal: 8,
        dt_importacao: '2026-03-24T17:02:29',
        nu_ano_orcamento: 2026,
        dt_decisao: '2024-08-12T00:00:00',
        dt_expedicao: '2024-11-25T16:44:26',
        cd_natureza: 'A',
        nu_acao: '50095587320238080011',
        de_entidade_devedora: 'ESTADO DO ESPÍRITO SANTO',
        vl_atualizado: 65481.86,
        cd_entidade_devedora: 2259,
        de_beneficiario: null,
        is_prioritario_doenca: true,
        is_prioritario_idade: false,
      },
    ],
  }

  await mkdir(directory, { recursive: true })
  await writeFile(filePath, JSON.stringify(payload), { flag: 'w' })

  return SourceRecord.create({
    tenantId: tenant.id,
    sourceDatasetId: dataset.id,
    source: 'tribunal',
    sourceUrl:
      'https://sistemas.tjes.jus.br/lup/lup/precatorios?cd_entidade_devedora=2259&fl_eh_ultima_importacao=S&page=0&size=2',
    sourceFilePath: filePath,
    sourceChecksum: `tjes-lup-import-test-${tenant.id}`,
    originalFilename: 'tjes-test-page.json',
    mimeType: 'application/json',
    fileSizeBytes: 1,
    collectedAt: DateTime.now(),
    rawData: {
      providerId: 'tjes-lup-api',
      courtAlias: 'tjes',
      debtor: {
        cd_entidade: 2259,
        de_nome_entidade: 'ESTADO DO ESPÍRITO SANTO',
        fl_regime_especial: 'N',
      },
    },
  })
}
