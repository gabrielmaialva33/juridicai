import { rm } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import SourceRecord from '#modules/siop/models/source_record'
import tjspPrecatorioCommunicationsAdapter, {
  TJSP_PRECATORIO_COMMUNICATIONS_URL,
  parseTjspCommunicationDetail,
  parseTjspCommunicationLinks,
} from '#modules/integrations/services/tjsp_precatorio_communications_adapter'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const CATEGORY_URL = `${TJSP_PRECATORIO_COMMUNICATIONS_URL}?tipoDestino=113`
const DETAIL_URL =
  'https://www.tjsp.jus.br/Precatorios/Comunicados/Comunicado?codigoComunicado=6148&pagina=1'
const DOCUMENT_URL = 'https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=61711'

const TJSP_LIST_HTML = `
  <section>
    <div class="lista-comunicados">
      <div class="data-comunicado">
        <time>28/08/2014</time>
      </div>
      <div class="comunicado">
        <h3>
          <a href="/Precatorios/Comunicados/Comunicado?codigoComunicado=6148&amp;pagina=1">
            Instituto de Previd&#234;ncia Municipal de Presidente Venceslau - Ipreven
          </a>
        </h3>
        <p>Lista de precat&#243;rios do INSTITUTO DE PREVID&#202;NCIA MUNICIPAL.</p>
      </div>
    </div>
  </section>
`

const TJSP_DETAIL_HTML = `
  <section>
    <div class="lista-comunicados">
      <div class="data-comunicado">
        <time>28/08/2014</time>
      </div>
      <div class="comunicado">
        <h3><strong>Instituto de Previd&#234;ncia Municipal de Presidente Venceslau - Ipreven</strong></h3>
        <p>
          Lista de precat&#243;rios do INSTITUTO DE PREVID&#202;NCIA MUNICIPAL DE PRESIDENTE VENCESLAU,
          protocolados no Egr&#233;gio Tribunal de Justi&#231;a do Estado de S&#227;o Paulo.
        </p>
        <ul class="list-group">
          <li class="list-group-item">
            <a class="UrlExternaTJSP" href="https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=61711" title="Lista geral de precat&#243;rios">
              Lista geral de precat&#243;rios
            </a>
          </li>
        </ul>
      </div>
    </div>
  </section>
`

test.group('TJSP precatorio communications adapter', () => {
  test('discovers communication links from TJSP category HTML', ({ assert }) => {
    const links = parseTjspCommunicationLinks(TJSP_LIST_HTML, 'municipal_entities', CATEGORY_URL)

    assert.lengthOf(links, 1)
    assert.deepInclude(links[0], {
      category: 'municipal_entities',
      title: 'Instituto de Previdência Municipal de Presidente Venceslau - Ipreven',
      summary: 'Lista de precatórios do INSTITUTO DE PREVIDÊNCIA MUNICIPAL.',
      url: DETAIL_URL,
      publishedAt: '2014-08-28',
      communicationCode: '6148',
      page: 1,
    })
  })

  test('extracts document links from communication detail HTML', ({ assert }) => {
    const detail = parseTjspCommunicationDetail(TJSP_DETAIL_HTML, DETAIL_URL)

    assert.equal(
      detail.title,
      'Instituto de Previdência Municipal de Presidente Venceslau - Ipreven'
    )
    assert.equal(detail.publishedAt, '2014-08-28')
    assert.lengthOf(detail.documentLinks, 1)
    assert.deepInclude(detail.documentLinks[0], {
      title: 'Lista geral de precatórios',
      url: DOCUMENT_URL,
      format: 'file_fetch',
      externalCode: '61711',
    })
  })

  test('persists communication details into tribunal source records idempotently', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()

    const firstRun = await tjspPrecatorioCommunicationsAdapter.sync({
      tenantId: tenant.id,
      categories: ['municipal_entities'],
      fetcher: fakeTjspFetch,
    })
    const secondRun = await tjspPrecatorioCommunicationsAdapter.sync({
      tenantId: tenant.id,
      categories: ['municipal_entities'],
      fetcher: fakeTjspFetch,
    })

    assert.include(firstRun, {
      discovered: 1,
      selected: 1,
      persisted: 2,
      documentLinks: 1,
    })
    assert.equal(firstRun.items[0].sourceRecordCreated, true)
    assert.equal(firstRun.items[0].documentSourceRecordsCreated, 1)
    assert.equal(secondRun.items[0].sourceRecordCreated, false)
    assert.equal(secondRun.items[0].documentSourceRecordsCreated, 0)

    const sourceRecords = await SourceRecord.query()
      .where('tenant_id', tenant.id)
      .where('source', 'tribunal')
      .orderBy('source_url', 'asc')
    const sourceRecord = sourceRecords.find((record) => record.sourceUrl === DETAIL_URL)
    const documentRecord = sourceRecords.find((record) => record.sourceUrl === DOCUMENT_URL)

    assert.exists(sourceRecord)
    assert.exists(documentRecord)
    assert.isNotNull(sourceRecord?.sourceDatasetId)
    assert.isNotNull(documentRecord?.sourceDatasetId)
    assert.equal(sourceRecord?.rawData?.providerId, 'tjsp-precatorio-communications')
    assert.equal(sourceRecord?.rawData?.courtAlias, 'tjsp')
    assert.equal(sourceRecord?.rawData?.category, 'municipal_entities')
    assert.equal(sourceRecord?.rawData?.communicationCode, '6148')
    assert.equal((sourceRecord?.rawData?.documentLinks as unknown[])?.length, 1)
    assert.equal(documentRecord?.rawData?.recordKind, 'attached_document')
    assert.equal(documentRecord?.rawData?.externalCode, '61711')
    assert.equal(documentRecord?.mimeType, 'application/pdf')
    assert.match(documentRecord?.sourceFilePath ?? '', /61711-[a-f0-9]{12}\.pdf$/)
    assert.equal(await countSourceRecords(tenant.id), 2)

    await cleanupTenantTjspData(tenant)
  })
})

async function fakeTjspFetch(input: string | URL | Request) {
  const url = String(input)

  if (url === CATEGORY_URL) {
    return new Response(TJSP_LIST_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  if (url === DETAIL_URL) {
    return new Response(TJSP_DETAIL_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  if (url === DOCUMENT_URL) {
    return new Response(Buffer.from('%PDF-1.7 fixture'), {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    })
  }

  return new Response('', { status: 404 })
}

async function cleanupTenantTjspData(tenant: Tenant) {
  await SourceRecord.query().where('tenant_id', tenant.id).delete()
  await rm(app.makePath('storage', 'tribunal', 'tjsp', tenant.id), {
    recursive: true,
    force: true,
  })
  await tenant.delete()
}

async function countSourceRecords(tenantId: string) {
  const [result] = await SourceRecord.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}
