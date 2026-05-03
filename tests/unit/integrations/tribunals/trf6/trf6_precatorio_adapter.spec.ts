import { rm } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import trf6PrecatorioAdapter, {
  TRF6_FEDERAL_PRECATORIO_URL,
  parseTrf6PrecatorioLinks,
} from '#modules/integrations/services/trf6_precatorio_adapter'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const TRF6_HTML = `
<a href="https://portal.trf6.jus.br/wp-content/uploads/2024/05/precatorios-federais-trf6-orcamento-2024.pdf">
  <strong>Precatórios Federais de 2024</strong> (art. 12, § 2º da Resolução CNJ nº 303 de 18/12/2019) - ORDEM CRONOLÓGICA DE APRESENTAÇÃO DOS PRECATÓRIOS.
</a>
<a href="https://portal.trf6.jus.br/wp-content/uploads/2024/05/precatorios-federias-trf6-orcamento-2025.pdf">
  <strong>Precatórios Federais de 2025</strong> (art. 12, § 2º da Resolução CNJ nº 303 de 18/12/2019) - ORDEM CRONOLÓGICA DE APRESENTAÇÃO DOS PRECATÓRIOS.
</a>
<a href="https://eproc2g.trf6.jus.br/eproc/externo_controlador.php?acao=gerar_arquivo_precatorio&amp;hash=7f9e1fbd97915e3bce36b6bd2528b0d3">
  <strong>Precatórios Federais de 2026</strong> (art. 12, § 2º da Resolução CNJ nº 303 de 18/12/2019) - ORDEM CRONOLÓGICA DE APRESENTAÇÃO DOS PRECATÓRIOS.
</a>
`

test.group('TRF6 precatorio adapter', () => {
  test('discovers public federal budget-order PDF links and skips captcha eproc links', ({
    assert,
  }) => {
    const links = parseTrf6PrecatorioLinks(TRF6_HTML, TRF6_FEDERAL_PRECATORIO_URL)

    assert.lengthOf(links, 2)
    assert.deepInclude(links, {
      kind: 'federal_budget_order',
      title:
        'Precatórios Federais de 2025 (art. 12, § 2º da Resolução CNJ nº 303 de 18/12/2019) - ORDEM CRONOLÓGICA DE APRESENTAÇÃO DOS PRECATÓRIOS.',
      url: 'https://portal.trf6.jus.br/wp-content/uploads/2024/05/precatorios-federias-trf6-orcamento-2025.pdf',
      year: 2025,
      pathId: 'precatorios-federias-trf6-orcamento-2025',
    })
  })

  test('downloads selected PDFs into tribunal source records idempotently', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await trf6PrecatorioAdapter.sync({
      tenantId: tenant.id,
      years: [2025],
      fetcher: fakeTrf6Fetch,
    })

    assert.equal(result.discovered, 2)
    assert.equal(result.selected, 1)
    assert.equal(result.downloaded, 1)
    assert.isTrue(result.items[0].sourceRecordCreated)

    const sourceRecord = await SourceRecord.query()
      .where('tenant_id', tenant.id)
      .where('source', 'tribunal')
      .firstOrFail()

    assert.equal(sourceRecord.rawData?.providerId, 'trf6-federal-precatorio-orders')
    assert.equal(sourceRecord.rawData?.courtAlias, 'trf6')
    assert.equal(sourceRecord.rawData?.sourceKind, 'federal_budget_order')
    assert.equal(sourceRecord.rawData?.year, 2025)

    const secondRun = await trf6PrecatorioAdapter.sync({
      tenantId: tenant.id,
      years: [2025],
      fetcher: fakeTrf6Fetch,
    })

    assert.isFalse(secondRun.items[0].sourceRecordCreated)
    assert.equal(await countSourceRecords(tenant.id), 1)

    await cleanupTenantTrf6Data(tenant)
  })
})

async function fakeTrf6Fetch(input: string | URL | Request) {
  const url = String(input)

  if (url === TRF6_FEDERAL_PRECATORIO_URL) {
    return new Response(TRF6_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  return new Response(Buffer.from('%PDF-1.4 fixture'), {
    status: 200,
    headers: { 'content-type': 'application/pdf' },
  })
}

async function cleanupTenantTrf6Data(tenant: Tenant) {
  await SourceRecord.query().where('tenant_id', tenant.id).delete()
  await rm(app.makePath('storage', 'tribunal', 'trf6', tenant.id), {
    recursive: true,
    force: true,
  })
  await tenant.delete()
}

async function countSourceRecords(tenantId: string) {
  const [result] = await SourceRecord.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}
