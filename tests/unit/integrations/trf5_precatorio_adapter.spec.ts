import { rm } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import trf5PrecatorioAdapter, {
  TRF5_PRECATORIO_MAP_URL,
  parseTrf5PrecatorioLinks,
} from '#modules/integrations/services/trf5_precatorio_adapter'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const TRF5_HTML = `
<h3 class="titulo-tipo-mapa">Lista de Precatórios Federais Pagos</h3>
<a href="/downloadMapas/29" title="LISTA PRECATÓRIOS_FEDERAIS_PAGOS_2026 _ARTs. 12, § 4º e 82_RES.303_2019">2026</a>
<h2>Dívida Consolidada</h2>
<h3>Federais</h3>
<div class="panel panel-primary">
  <div class="panel-heading">2025</div>
  <div class="panel-body">
    <select>
      <option value="">Selecione a instituição</option>
      <option value="/downloadDividaFederal/554">INSS - INSTITUTO NACIONAL DO SEGURO SOCIAL - ALIMENTAR</option>
    </select>
  </div>
</div>
<h3>Estaduais e Municipais</h3>
`

test.group('TRF5 precatorio adapter', () => {
  test('discovers paid and federal debt PDF links from the public map page', ({ assert }) => {
    const links = parseTrf5PrecatorioLinks(TRF5_HTML, TRF5_PRECATORIO_MAP_URL)

    assert.lengthOf(links, 2)
    assert.deepInclude(links, {
      kind: 'paid_precatorios',
      title: 'LISTA PRECATÓRIOS_FEDERAIS_PAGOS_2026 _ARTs. 12, § 4º e 82_RES.303_2019',
      url: 'https://rpvprecatorio.trf5.jus.br/downloadMapas/29',
      year: 2026,
      debtorName: null,
      pathId: '29',
    })
    assert.deepInclude(links, {
      kind: 'federal_debt',
      title: 'TRF5 dívida federal 2025 - INSS - INSTITUTO NACIONAL DO SEGURO SOCIAL - ALIMENTAR',
      url: 'https://rpvprecatorio.trf5.jus.br/downloadDividaFederal/554',
      year: 2025,
      debtorName: 'INSS - INSTITUTO NACIONAL DO SEGURO SOCIAL - ALIMENTAR',
      pathId: '554',
    })
  })

  test('downloads selected PDFs into tribunal source records idempotently', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await trf5PrecatorioAdapter.sync({
      tenantId: tenant.id,
      years: [2025],
      kinds: ['federal_debt'],
      fetcher: fakeTrf5Fetch,
    })

    assert.equal(result.discovered, 2)
    assert.equal(result.selected, 1)
    assert.equal(result.downloaded, 1)
    assert.isTrue(result.items[0].sourceRecordCreated)

    const sourceRecord = await SourceRecord.query()
      .where('tenant_id', tenant.id)
      .where('source', 'tribunal')
      .firstOrFail()

    assert.equal(sourceRecord.rawData?.providerId, 'trf5-precatorio-reports')
    assert.equal(sourceRecord.rawData?.courtAlias, 'trf5')
    assert.equal(sourceRecord.rawData?.sourceKind, 'federal_debt')
    assert.equal(sourceRecord.rawData?.year, 2025)

    const secondRun = await trf5PrecatorioAdapter.sync({
      tenantId: tenant.id,
      years: [2025],
      kinds: ['federal_debt'],
      fetcher: fakeTrf5Fetch,
    })

    assert.isFalse(secondRun.items[0].sourceRecordCreated)
    assert.equal(await countSourceRecords(tenant.id), 1)

    await cleanupTenantTrf5Data(tenant)
  })
})

async function fakeTrf5Fetch(input: string | URL | Request) {
  const url = String(input)

  if (url === TRF5_PRECATORIO_MAP_URL) {
    return new Response(TRF5_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  return new Response(Buffer.from('%PDF-1.4 fixture'), {
    status: 200,
    headers: { 'content-type': 'application/pdf' },
  })
}

async function cleanupTenantTrf5Data(tenant: Tenant) {
  await SourceRecord.query().where('tenant_id', tenant.id).delete()
  await rm(app.makePath('storage', 'tribunal', 'trf5', tenant.id), {
    recursive: true,
    force: true,
  })
  await tenant.delete()
}

async function countSourceRecords(tenantId: string) {
  const [result] = await SourceRecord.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}
