import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import DebtorPaymentStat from '#modules/debtors/models/debtor_payment_stat'
import Debtor from '#modules/debtors/models/debtor'
import SourceDataset from '#modules/integrations/models/source_dataset'
import tjrjAnnualMapImportService, {
  parseTjrjAnnualMapRows,
} from '#modules/integrations/services/tjrj_annual_map_import_service'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const TJRJ_ANNUAL_MAP_TEXT = `
Tribunal de Justiça do Estado do Rio de Janeiro
Mapa Anual de Precatórios 2026* (CNJ)
TJRJ 2025 E RJ E I 03066219000181 RIO-PREVIDÊNCIA (03.066.219/0001-81) R$ 3.152.817.240,81 R$ 367.248.136,03 R$ 3.044.881.942,69 R$ 798.090.164,17
TJRJ 2025 M RJ 3300704 E D R$ 174.284.355,22 R$ 19.313.111,44 R$ 174.308.823,52 R$ 38.248.803,03
INSTITUTO DE PREVIDENCIA DOS SERVIDORES MUNICIPAIS DE
TJRJ 2025 M RJ 3303500 E I 03450083000109 R$ 946.177,24 R$ 81.574,10 R$ 903.835,97 R$ 9.532.848,30
NOVA IGUACU - PREVINI
Página 1 de 4
`

test.group('TJRJ annual map import service', () => {
  test('parses debtor annual map rows from TJRJ PDF text', ({ assert }) => {
    const rows = parseTjrjAnnualMapRows(TJRJ_ANNUAL_MAP_TEXT)

    assert.lengthOf(rows, 3)
    assert.equal(rows[0].debtorName, 'RIO-PREVIDÊNCIA (03.066.219/0001-81)')
    assert.equal(rows[0].cnpj, '03066219000181')
    assert.equal(rows[0].debtStockAfterPayment, '3044881942.69')
    assert.equal(rows[1].debtorName, 'Municipality IBGE 3300704 - RJ')
    assert.equal(
      rows[2].debtorName,
      'INSTITUTO DE PREVIDENCIA DOS SERVIDORES MUNICIPAIS DE NOVA IGUACU - PREVINI'
    )
    assert.equal(rows[2].currentYearIssuedAmount, '9532848.30')
  })

  test('imports annual map rows into debtor payment statistics idempotently', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createSourceRecord(tenant)

    const result = await tjrjAnnualMapImportService.importSourceRecord(sourceRecord.id, {
      maxRows: 2,
      pdfTextExtractor: async () => TJRJ_ANNUAL_MAP_TEXT,
    })

    assert.equal(result.extraction.format, 'pdf')
    assert.deepEqual(result.stats, {
      totalRows: 3,
      validRows: 3,
      selectedRows: 2,
      inserted: 2,
      updated: 0,
      skipped: 0,
      errors: 0,
    })

    const rioPrevidencia = await Debtor.query()
      .where('tenant_id', tenant.id)
      .where('cnpj', '03066219000181')
      .firstOrFail()
    assert.equal(rioPrevidencia.debtorType, 'autarchy')
    assert.equal(rioPrevidencia.paymentRegime, 'special')
    assert.equal(rioPrevidencia.debtStockEstimate, '3842972106.86')

    const stat = await DebtorPaymentStat.query()
      .where('tenant_id', tenant.id)
      .where('debtor_id', rioPrevidencia.id)
      .firstOrFail()
    assert.equal(stat.source, 'tjrj_annual_map:2025')
    assert.equal(stat.paidVolume, '367248136.03')
    assert.equal(stat.openDebtStock, '3842972106.86')
    assert.isTrue(stat.regimeSpecialActive)

    const secondRun = await tjrjAnnualMapImportService.importSourceRecord(sourceRecord.id, {
      maxRows: 2,
      pdfTextExtractor: async () => TJRJ_ANNUAL_MAP_TEXT,
    })
    assert.equal(secondRun.stats.inserted, 0)
    assert.equal(secondRun.stats.updated, 2)
    assert.equal(await countRows(DebtorPaymentStat, tenant.id), 2)

    await cleanupTenantData(tenant)
  })
})

async function createSourceRecord(tenant: Tenant) {
  const dataset = await SourceDataset.findByOrFail('key', 'court-annual-map-pages')

  return SourceRecord.create({
    tenantId: tenant.id,
    sourceDatasetId: dataset.id,
    source: 'tribunal',
    sourceUrl:
      'https://www.tjrj.jus.br/documents/d/precatorios/mapa_anual_de_precatorios_2026_cnj-orcamento_do_ano_de_2025',
    sourceFilePath: '/tmp/tjrj-annual-map-test.pdf',
    sourceChecksum: `test-tjrj-${tenant.id}`,
    originalFilename: 'mapa_anual_de_precatorios_2026.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 1,
    collectedAt: DateTime.now(),
    rawData: {
      providerId: 'generic-tribunal-public-source',
      targetKey: 'court-map:tjrj',
      courtAlias: 'tjrj',
      sourceKind: 'linked_document',
      title: '2026 >>>',
      format: 'pdf',
    },
  })
}

async function countRows(model: typeof DebtorPaymentStat, tenantId: string) {
  const [result] = await model.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}

async function cleanupTenantData(tenant: Tenant) {
  await SourceRecord.query().where('tenant_id', tenant.id).delete()
  await Debtor.query().where('tenant_id', tenant.id).delete()
  await tenant.delete()
}
