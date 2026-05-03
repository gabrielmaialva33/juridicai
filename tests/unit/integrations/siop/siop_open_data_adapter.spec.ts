import { rm } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import siopOpenDataAdapter, {
  SIOP_OPEN_DATA_LANDING_URL,
  parseSiopOpenDataLinks,
} from '#modules/integrations/services/siop_open_data_adapter'
import SiopImport from '#modules/siop/models/siop_import'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const OPEN_DATA_HTML = `
  <a href="https://www1.siop.planejamento.gov.br/download/orcamento.csv">
    Série histórica de dados orçamentários a partir de 2007
  </a>
  <a href="https://www1.siop.planejamento.gov.br/download/correcao.csv">
    Série com o índice de correção monetária utilizado para atualizar os valores históricos para valores presentes
  </a>
  <a href="https://www1.siop.planejamento.gov.br/download/precatorios-2024.csv">
    Precatórios expedidos para 2024
  </a>
  <a href="https://www1.siop.planejamento.gov.br/download/precatorios-2025.csv">
    Precatórios expedidos para 2025
  </a>
`

test.group('SIOP open-data adapter', () => {
  test('discovers official budget, correction, and expedition links from HTML', ({ assert }) => {
    const links = parseSiopOpenDataLinks(OPEN_DATA_HTML, SIOP_OPEN_DATA_LANDING_URL)

    assert.lengthOf(links, 4)
    assert.deepInclude(links, {
      kind: 'budget_history',
      title: 'Série histórica de dados orçamentários a partir de 2007',
      url: 'https://www1.siop.planejamento.gov.br/download/orcamento.csv',
      year: null,
    })
    assert.deepInclude(links, {
      kind: 'expedition_file',
      title: 'Precatórios expedidos para 2024',
      url: 'https://www1.siop.planejamento.gov.br/download/precatorios-2024.csv',
      year: 2024,
    })
  })

  test('downloads selected annual files into source records and creates pending imports', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()

    const result = await siopOpenDataAdapter.sync({
      tenantId: tenant.id,
      years: [2024],
      fetcher: fakeOpenDataFetch,
    })

    assert.equal(result.discovered, 4)
    assert.equal(result.selected, 3)
    assert.equal(result.downloaded, 3)
    assert.equal(result.importsCreated, 1)
    assert.equal(result.importsReused, 0)

    const sourceRecords = await SourceRecord.query().where('tenant_id', tenant.id)
    const imports = await SiopImport.query().where('tenant_id', tenant.id)

    assert.lengthOf(sourceRecords, 3)
    assert.lengthOf(imports, 1)
    assert.equal(imports[0].exerciseYear, 2024)
    assert.equal(imports[0].status, 'pending')

    const secondRun = await siopOpenDataAdapter.sync({
      tenantId: tenant.id,
      years: [2024],
      fetcher: fakeOpenDataFetch,
    })

    assert.equal(secondRun.importsCreated, 0)
    assert.equal(secondRun.importsReused, 1)
    assert.equal(await countSourceRecords(tenant.id), 3)

    await cleanupTenantOpenData(tenant)
  })
})

async function fakeOpenDataFetch(input: string | URL | Request) {
  const url = String(input)

  if (url === SIOP_OPEN_DATA_LANDING_URL) {
    return new Response(OPEN_DATA_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  return new Response(`external_id;valor\n${basenameFromUrl(url)};100`, {
    status: 200,
    headers: { 'content-type': 'text/csv' },
  })
}

function basenameFromUrl(url: string) {
  return new URL(url).pathname.split('/').at(-1) ?? 'file.csv'
}

async function cleanupTenantOpenData(tenant: Tenant) {
  await SiopImport.query().where('tenant_id', tenant.id).delete()
  await SourceRecord.query().where('tenant_id', tenant.id).delete()
  await rm(app.makePath('storage', 'siop', 'open-data', tenant.id), {
    recursive: true,
    force: true,
  })
  await tenant.delete()
}

async function countSourceRecords(tenantId: string) {
  const [result] = await SourceRecord.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}
