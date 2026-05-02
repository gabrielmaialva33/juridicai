import { rm } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import genericTribunalPublicSourceAdapter, {
  parsePublicSourceLinks,
} from '#modules/integrations/services/generic_tribunal_public_source_adapter'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'

const LANDING_URL = 'https://example.test/precatorios'
const PDF_URL = 'https://example.test/files/lista-cronologica-2026.pdf'
const CSV_URL = 'https://example.test/files/mapa-anual-precatorios.csv'
const MAP_PAGE_URL = 'https://example.test/mapa-anual'
const NESTED_PDF_URL = 'https://example.test/documents/d/precatorios/mapa_anual_de_precatorios_2026'

const LANDING_HTML = `
  <html>
    <body>
      <a href="/files/lista-cronologica-2026.pdf">Lista Cronológica de Precatórios 2026</a>
      <a href="/files/mapa-anual-precatorios.csv">Mapa anual de precatórios CSV</a>
      <a href="/mapa-anual">Mapa Anual de Precatórios (CNJ)</a>
      <a href="#main-content">Pular para o conteúdo principal</a>
      <a href="/precatorios">Home</a>
      <a href="/noticias">Notícias gerais</a>
    </body>
  </html>
`

const MAP_PAGE_HTML = `
  <html>
    <body>
      <a href="/documents/d/precatorios/mapa_anual_de_precatorios_2026">2026 &gt;&gt;&gt;</a>
    </body>
  </html>
`

test.group('Generic tribunal public source adapter', () => {
  test('discovers relevant public precatorio links from a tribunal landing page', ({ assert }) => {
    const links = parsePublicSourceLinks(LANDING_HTML, LANDING_URL)

    assert.deepEqual(
      links.map((link) => ({ title: link.title, url: link.url, format: link.format })),
      [
        {
          title: 'Lista Cronológica de Precatórios 2026',
          url: PDF_URL,
          format: 'pdf',
        },
        {
          title: 'Mapa anual de precatórios CSV',
          url: CSV_URL,
          format: 'csv',
        },
        {
          title: 'Mapa Anual de Precatórios (CNJ)',
          url: MAP_PAGE_URL,
          format: 'html',
        },
      ]
    )
  })

  test('persists landing pages and linked documents as tenant-scoped source records', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const fetcher = async (url: string | URL | Request) => {
      const value = String(url)

      if (value === LANDING_URL) {
        return new Response(LANDING_HTML, {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      }

      if (value === PDF_URL) {
        return new Response(Buffer.from('%PDF-1.4 fake'), {
          headers: { 'content-type': 'application/pdf' },
        })
      }

      if (value === CSV_URL) {
        return new Response(Buffer.from('numero;valor\n1;100,00'), {
          headers: { 'content-type': 'text/csv' },
        })
      }

      if (value === MAP_PAGE_URL) {
        return new Response(MAP_PAGE_HTML, {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      }

      if (value === NESTED_PDF_URL) {
        return new Response(Buffer.from('%PDF-1.4 nested fake'), {
          headers: { 'content-type': 'application/pdf' },
        })
      }

      return new Response('not found', { status: 404 })
    }

    const result = await genericTribunalPublicSourceAdapter.sync({
      tenantId: tenant.id,
      fetcher,
      target: {
        key: 'court-map:tjxx',
        sourceDatasetKey: 'court-annual-map-pages',
        name: 'TJXX public precatorio portal',
        sourceUrl: LANDING_URL,
        courtAlias: 'tjxx',
        stateCode: 'XX',
        metadata: { purpose: 'test' },
      },
    })

    assert.equal(result.discovered, 4)
    assert.equal(result.selected, 3)
    assert.equal(result.persisted, 5)
    assert.equal(result.sourceRecordsCreated, 5)

    const sourceRecords = await SourceRecord.query()
      .where('tenant_id', tenant.id)
      .where('source', 'tribunal')
      .orderBy('source_url', 'asc')

    assert.deepEqual(
      sourceRecords.map((record) => ({
        sourceUrl: record.sourceUrl,
        sourceKind: record.rawData?.sourceKind,
        courtAlias: record.rawData?.courtAlias,
      })),
      [
        { sourceUrl: NESTED_PDF_URL, sourceKind: 'linked_document', courtAlias: 'tjxx' },
        { sourceUrl: PDF_URL, sourceKind: 'linked_document', courtAlias: 'tjxx' },
        { sourceUrl: CSV_URL, sourceKind: 'linked_document', courtAlias: 'tjxx' },
        { sourceUrl: MAP_PAGE_URL, sourceKind: 'linked_document', courtAlias: 'tjxx' },
        { sourceUrl: LANDING_URL, sourceKind: 'landing_page', courtAlias: 'tjxx' },
      ]
    )

    const secondRun = await genericTribunalPublicSourceAdapter.sync({
      tenantId: tenant.id,
      fetcher,
      target: {
        key: 'court-map:tjxx',
        sourceDatasetKey: 'court-annual-map-pages',
        name: 'TJXX public precatorio portal',
        sourceUrl: LANDING_URL,
        courtAlias: 'tjxx',
        stateCode: 'XX',
        metadata: { purpose: 'test' },
      },
    })

    assert.equal(secondRun.sourceRecordsCreated, 0)
    assert.equal(await countSourceRecords(tenant.id), 5)

    await SourceRecord.query().where('tenant_id', tenant.id).delete()
    await rm(app.makePath('storage', 'tribunal', 'tjxx', tenant.id), {
      recursive: true,
      force: true,
    })
    await tenant.delete()
  })
})

async function countSourceRecords(tenantId: string) {
  const [result] = await SourceRecord.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}
