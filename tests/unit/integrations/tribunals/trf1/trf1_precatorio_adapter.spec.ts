import { rm } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import trf1PrecatorioAdapter, {
  TRF1_PRECATORIO_PAGE_URL,
  parseTrf1PrecatorioLinks,
} from '#modules/integrations/services/trf1_precatorio_adapter'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const TRF1_HTML = `
<h3>PRECATÓRIOS FEDERAIS</h3>
<a href="/conteudo/files/proposta-2027.pdf">Proposta de 2027 (Art. 12, § 2º Resolução nº 303, de 18/12/2019 do CNJ)</a>
<a href="/conteudo/files/mapa-divida-2025.xlsx">Mapa da situação da dívida de Precatórios - Referência 2025 (Art. 85, § 1º da Resolução nº 303 – CNJ)</a>

<h3>PRECATÓRIOS DE ENTES SUBNACIONAIS (ESTADOS, MUNICÍPIOS E DISTRITO FEDERAL)</h3>
<a href="/conteudo/files/subnacional-proposta-2026.pdf">Proposta de 2026 (Art. 85, § 1º da Resolução nº 303, de 18/12/2019 do CNJ)</a>
<a href="/conteudo/files/repasses-2025.csv">Repasses Entidades Devedoras Estaduais e Municipais de 2025 (Art. 82,da Resolução nº 303, de 18/12/2019 do CNJ)</a>
<a href="/conteudo/files/divida-consolidada-2025.xlsx">Dívida consolidada até 31/12/2025 (Art. 85, § 1º da Resolução nº 303, de 18/12/2019 do CNJ)</a>
<a href="/conteudo/files/subnacional-mapa-2025.xlsx">Mapa da situação da dívida de Precatórios - Referência 2025 (Art. 85, § 1º da Resolução nº 303 – CNJ)</a>
`

test.group('TRF1 precatorio adapter', () => {
  test('discovers federal and subnational precatorio report links', ({ assert }) => {
    const links = parseTrf1PrecatorioLinks(TRF1_HTML, TRF1_PRECATORIO_PAGE_URL)

    assert.lengthOf(links, 6)
    assert.deepInclude(links, {
      kind: 'federal_budget_proposal',
      title: 'Proposta de 2027 (Art. 12, § 2º Resolução nº 303, de 18/12/2019 do CNJ)',
      url: 'https://www.trf1.jus.br/conteudo/files/proposta-2027.pdf',
      year: 2027,
      pathId: 'proposta-2027',
    })
    assert.deepInclude(links, {
      kind: 'subnational_repasses',
      title:
        'Repasses Entidades Devedoras Estaduais e Municipais de 2025 (Art. 82,da Resolução nº 303, de 18/12/2019 do CNJ)',
      url: 'https://www.trf1.jus.br/conteudo/files/repasses-2025.csv',
      year: 2025,
      pathId: 'repasses-2025',
    })
    assert.deepInclude(links, {
      kind: 'subnational_debt_map',
      title:
        'Mapa da situação da dívida de Precatórios - Referência 2025 (Art. 85, § 1º da Resolução nº 303 – CNJ)',
      url: 'https://www.trf1.jus.br/conteudo/files/subnacional-mapa-2025.xlsx',
      year: 2025,
      pathId: 'subnacional-mapa-2025',
    })
  })

  test('downloads selected files into tribunal source records idempotently', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await trf1PrecatorioAdapter.sync({
      tenantId: tenant.id,
      years: [2025],
      kinds: ['subnational_repasses'],
      fetcher: fakeTrf1Fetch,
    })

    assert.equal(result.discovered, 6)
    assert.equal(result.selected, 1)
    assert.equal(result.downloaded, 1)
    assert.isTrue(result.items[0].sourceRecordCreated)

    const sourceRecord = await SourceRecord.query()
      .where('tenant_id', tenant.id)
      .where('source', 'tribunal')
      .firstOrFail()

    assert.equal(sourceRecord.rawData?.providerId, 'trf1-precatorio-reports')
    assert.equal(sourceRecord.rawData?.courtAlias, 'trf1')
    assert.equal(sourceRecord.rawData?.sourceKind, 'subnational_repasses')
    assert.equal(sourceRecord.rawData?.year, 2025)

    const secondRun = await trf1PrecatorioAdapter.sync({
      tenantId: tenant.id,
      years: [2025],
      kinds: ['subnational_repasses'],
      fetcher: fakeTrf1Fetch,
    })

    assert.isFalse(secondRun.items[0].sourceRecordCreated)
    assert.equal(await countSourceRecords(tenant.id), 1)

    await cleanupTenantTrf1Data(tenant)
  })
})

async function fakeTrf1Fetch(input: string | URL | Request) {
  const url = String(input)

  if (url === TRF1_PRECATORIO_PAGE_URL) {
    return new Response(TRF1_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  return new Response(Buffer.from('processo;valor\n0000000-00.2025.4.01.0000;100,00\n'), {
    status: 200,
    headers: { 'content-type': 'text/csv' },
  })
}

async function cleanupTenantTrf1Data(tenant: Tenant) {
  await SourceRecord.query().where('tenant_id', tenant.id).delete()
  await rm(app.makePath('storage', 'tribunal', 'trf1', tenant.id), {
    recursive: true,
    force: true,
  })
  await tenant.delete()
}

async function countSourceRecords(tenantId: string) {
  const [result] = await SourceRecord.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}
