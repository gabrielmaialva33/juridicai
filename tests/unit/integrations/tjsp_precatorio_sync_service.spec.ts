import { rm } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import CoverageRun from '#modules/integrations/models/coverage_run'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SourceRecord from '#modules/siop/models/source_record'
import tjspPrecatorioSyncService from '#modules/integrations/services/tjsp_precatorio_sync_service'
import { TJSP_PRECATORIO_COMMUNICATIONS_URL } from '#modules/integrations/services/tjsp_precatorio_communications_adapter'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const CATEGORY_URL = `${TJSP_PRECATORIO_COMMUNICATIONS_URL}?tipoDestino=113`
const DETAIL_URL =
  'https://www.tjsp.jus.br/Precatorios/Comunicados/Comunicado?codigoComunicado=6148&pagina=1'
const DOCUMENT_URL = 'https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=61711'
const VALID_CNJ = '0001234-94.2024.4.01.3400'

const LIST_HTML = `
  <section>
    <div class="lista-comunicados">
      <div class="data-comunicado"><time>28/08/2014</time></div>
      <div class="comunicado">
        <h3>
          <a href="/Precatorios/Comunicados/Comunicado?codigoComunicado=6148&amp;pagina=1">
            Município de Santos
          </a>
        </h3>
        <p>Lista de precatórios do Município de Santos.</p>
      </div>
    </div>
  </section>
`

const DETAIL_HTML = `
  <section>
    <div class="lista-comunicados">
      <div class="data-comunicado"><time>28/08/2014</time></div>
      <div class="comunicado">
        <h3><strong>Município de Santos</strong></h3>
        <p>Lista de precatórios do Município de Santos.</p>
        <ul class="list-group">
          <li class="list-group-item">
            <a href="${DOCUMENT_URL}">Lista geral de precatórios</a>
          </li>
        </ul>
      </div>
    </div>
  </section>
`

const DOCUMENT_CSV = [
  'Ordem;Processo;Entidade;Natureza;Valor;Ano',
  `3;${VALID_CNJ};Município de Santos;Alimentar;R$ 55.000,00;2024`,
].join('\n')

test.group('TJSP precatorio sync service', () => {
  test('syncs communications, downloads documents, imports assets, and records coverage', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const result = await tjspPrecatorioSyncService.sync({
      tenantId: tenant.id,
      categories: ['municipal_entities'],
      fetcher: fakeTjspFetch,
      origin: 'manual_retry',
    })

    assert.deepInclude(result, {
      discovered: 1,
      selected: 1,
      sourceRecordsPersisted: 2,
      communicationSourceRecords: 1,
      documentSourceRecords: 1,
      documentLinks: 1,
      importedDocuments: 1,
      extractedRows: 1,
      importableRows: 1,
      assetsInserted: 1,
      assetsUpdated: 0,
      skippedRows: 0,
      errors: 0,
    })

    const asset = await PrecatorioAsset.query()
      .where('tenant_id', tenant.id)
      .preload('debtor')
      .firstOrFail()
    const valuation = await AssetValuation.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .firstOrFail()
    const events = await AssetEvent.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
    const coverageRun = await CoverageRun.query()
      .where('tenant_id', tenant.id)
      .preload('sourceDataset')
      .firstOrFail()

    assert.equal(asset.cnjNumber, VALID_CNJ)
    assert.equal(asset.debtor.name, 'Município de Santos')
    assert.equal(valuation.faceValue, '55000.00')
    assert.lengthOf(events, 1)
    assert.equal(coverageRun.sourceDataset.key, 'tjsp-precatorio-communications')
    assert.equal(coverageRun.status, 'completed')
    assert.equal(coverageRun.discoveredCount, 1)
    assert.equal(coverageRun.sourceRecordsCount, 2)
    assert.equal(coverageRun.createdAssetsCount, 1)
    assert.equal(coverageRun.enrichedAssetsCount, 1)

    await cleanupTenantData(tenant)
  })
})

async function fakeTjspFetch(input: string | URL | Request) {
  const url = String(input)

  if (url === CATEGORY_URL) {
    return new Response(LIST_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  if (url === DETAIL_URL) {
    return new Response(DETAIL_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  if (url === DOCUMENT_URL) {
    return new Response(DOCUMENT_CSV, {
      status: 200,
      headers: { 'content-type': 'text/csv; charset=utf-8' },
    })
  }

  return new Response('', { status: 404 })
}

async function cleanupTenantData(tenant: Tenant) {
  await SourceRecord.query().where('tenant_id', tenant.id).delete()
  await CoverageRun.query().where('tenant_id', tenant.id).delete()
  await rm(app.makePath('storage', 'tribunal', 'tjsp', tenant.id), {
    recursive: true,
    force: true,
  })
  await tenant.delete()
}
