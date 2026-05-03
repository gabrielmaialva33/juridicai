import { rm } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import trf3PrecatorioAdapter, {
  TRF3_CNJ_102_PRECATORIO_URL,
  parseTrf3PrecatorioLinks,
} from '#modules/integrations/services/trf3_precatorio_adapter'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const TRF3_HTML = `
<h3>2026</h3>
<ul>
  <li>Março
    <a href="/documentos/sepe/RelatoriosCNJ_Res102/2026/marco.csv">CSV</a>
    <a href="/documentos/sepe/RelatoriosCNJ_Res102/2026/marco.pdf">pdf</a>
    <a href="/documentos/sepe/RelatoriosCNJ_Res102/2026/marco.xlsx">xlsx</a>
  </li>
  <li>Fevereiro
    <a href="/documentos/sepe/RelatoriosCNJ_Res102/2026/fevereiro.csv">csv</a>
    <a href="/documentos/sepe/RelatoriosCNJ_Res102/2026/fevereiro.pdf">pdf</a>
    <a href="/documentos/sepe/RelatoriosCNJ_Res102/2026/fevereiro.xlsx">xlsx</a>
  </li>
</ul>
<h3>2025</h3>
<ul>
  <li>Dezembro
    <a href="/documentos/sepe/RelatoriosCNJ_Res102/2025/dezembro.csv">csv</a>
  </li>
</ul>
`

test.group('TRF3 precatorio adapter', () => {
  test('discovers monthly CNJ 102 CSV, PDF and XLSX links with period metadata', ({ assert }) => {
    const links = parseTrf3PrecatorioLinks(TRF3_HTML, TRF3_CNJ_102_PRECATORIO_URL)

    assert.lengthOf(links, 7)
    assert.deepInclude(links, {
      kind: 'cnj_102_monthly_report',
      title: 'TRF3 Anexo II CNJ 102/2009 Março 2026 CSV',
      url: 'https://www.trf3.jus.br/documentos/sepe/RelatoriosCNJ_Res102/2026/marco.csv',
      year: 2026,
      month: 3,
      monthName: 'Março',
      format: 'csv',
      pathId: 'marco',
    })
    assert.deepInclude(links, {
      kind: 'cnj_102_monthly_report',
      title: 'TRF3 Anexo II CNJ 102/2009 Fevereiro 2026 XLSX',
      url: 'https://www.trf3.jus.br/documentos/sepe/RelatoriosCNJ_Res102/2026/fevereiro.xlsx',
      year: 2026,
      month: 2,
      monthName: 'Fevereiro',
      format: 'xlsx',
      pathId: 'fevereiro',
    })
  })

  test('downloads selected files into tribunal source records idempotently', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await trf3PrecatorioAdapter.sync({
      tenantId: tenant.id,
      years: [2026],
      months: [3],
      formats: ['csv'],
      fetcher: fakeTrf3Fetch,
    })

    assert.equal(result.discovered, 7)
    assert.equal(result.selected, 1)
    assert.equal(result.downloaded, 1)
    assert.isTrue(result.items[0].sourceRecordCreated)

    const sourceRecord = await SourceRecord.query()
      .where('tenant_id', tenant.id)
      .where('source', 'tribunal')
      .firstOrFail()

    assert.equal(sourceRecord.rawData?.providerId, 'trf3-cnj-102-precatorios-rpv')
    assert.equal(sourceRecord.rawData?.courtAlias, 'trf3')
    assert.equal(sourceRecord.rawData?.sourceKind, 'cnj_102_monthly_report')
    assert.equal(sourceRecord.rawData?.year, 2026)
    assert.equal(sourceRecord.rawData?.month, 3)
    assert.equal(sourceRecord.rawData?.format, 'csv')

    const secondRun = await trf3PrecatorioAdapter.sync({
      tenantId: tenant.id,
      years: [2026],
      months: [3],
      formats: ['csv'],
      fetcher: fakeTrf3Fetch,
    })

    assert.isFalse(secondRun.items[0].sourceRecordCreated)
    assert.equal(await countSourceRecords(tenant.id), 1)

    await cleanupTenantTrf3Data(tenant)
  })
})

async function fakeTrf3Fetch(input: string | URL | Request) {
  const url = String(input)

  if (url === TRF3_CNJ_102_PRECATORIO_URL) {
    return new Response(TRF3_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  return new Response(Buffer.from('numero;valor\n0000000-00.2026.4.03.0000;100,00\n'), {
    status: 200,
    headers: { 'content-type': 'text/csv' },
  })
}

async function cleanupTenantTrf3Data(tenant: Tenant) {
  await SourceRecord.query().where('tenant_id', tenant.id).delete()
  await rm(app.makePath('storage', 'tribunal', 'trf3', tenant.id), {
    recursive: true,
    force: true,
  })
  await tenant.delete()
}

async function countSourceRecords(tenantId: string) {
  const [result] = await SourceRecord.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}
