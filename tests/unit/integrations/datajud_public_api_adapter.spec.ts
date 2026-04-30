import { test } from '@japa/runner'
import dataJudPublicApiAdapter from '#modules/integrations/services/datajud_public_api_adapter'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import SourceRecord from '#modules/siop/models/source_record'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const DATAJUD_HIT = {
  _index: 'api_publica_tjdft',
  _id: 'TJDFT_G1_07020420520208070003',
  _score: null,
  _source: {
    'numeroProcesso': '07020420520208070003',
    'classe': { codigo: 7, nome: 'Procedimento Comum Cível' },
    'sistema': { codigo: 1, nome: 'PJe' },
    'formato': { codigo: 1, nome: 'Eletrônico' },
    'tribunal': 'TJDFT',
    'dataHoraUltimaAtualizacao': '2024-03-22T23:13:45.049000Z',
    'grau': 'G1',
    '@timestamp': '2024-03-22T23:13:45.049000Z',
    'dataAjuizamento': '20200128135532',
    'movimentos': [{ codigo: 26, nome: 'Distribuição', dataHora: '2020-01-28T13:55:33.000Z' }],
    'id': 'TJDFT_G1_07020420520208070003',
    'nivelSigilo': 0,
    'orgaoJulgador': {
      codigoMunicipioIBGE: 5300108,
      codigo: 43179,
      nome: '3a VARA CIVEL DE CEILANDIA',
    },
    'assuntos': [
      { codigo: 4656, nome: 'Direito Autoral' },
      { codigo: 10433, nome: 'Indenização por Dano Moral' },
    ],
  },
  sort: [1711149225049],
}

test.group('DataJud public API adapter', () => {
  test('searches a court alias with APIKey auth and CNJ digits', async ({ assert }) => {
    const requests: CapturedRequest[] = []

    const response = await dataJudPublicApiAdapter.searchByCnj({
      courtAlias: 'tjdft',
      cnjNumber: '0702042-05.2020.8.07.0003',
      apiKey: 'test-key',
      fetcher: fakeDataJudFetch(requests, [dataJudResponse([DATAJUD_HIT])]),
    })

    assert.equal(response.hits.total.value, 1)
    assert.equal(
      requests[0].url,
      'https://api-publica.datajud.cnj.jus.br/api_publica_tjdft/_search'
    )
    assert.equal(requests[0].headers.Authorization, 'APIKey test-key')
    assert.deepEqual(requests[0].body, {
      query: {
        match: {
          numeroProcesso: '07020420520208070003',
        },
      },
    })
  })

  test('paginates with sort and search_after', async ({ assert }) => {
    const requests: CapturedRequest[] = []
    const pages = dataJudPublicApiAdapter.searchPages({
      courtAlias: 'tjdft',
      body: { query: { match_all: {} } },
      pageSize: 1,
      apiKey: 'test-key',
      fetcher: fakeDataJudFetch(requests, [dataJudResponse([DATAJUD_HIT]), dataJudResponse([])]),
    })
    const collected = []

    for await (const page of pages) {
      collected.push(page)
    }

    assert.lengthOf(collected, 2)
    assert.deepEqual(requests[0].body.sort, [{ '@timestamp': { order: 'asc' } }])
    assert.deepEqual(requests[1].body.search_after, [1711149225049])
  })

  test('stores source records and upserts judicial processes by CNJ number', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      cnjNumber: '0702042-05.2020.8.07.0003',
    }).create()

    const result = await dataJudPublicApiAdapter.syncByCnj({
      tenantId: tenant.id,
      cnjNumber: '0702042-05.2020.8.07.0003',
      courtAliases: ['tjdft'],
      apiKey: 'test-key',
      fetcher: fakeDataJudFetch([], [dataJudResponse([DATAJUD_HIT])]),
    })

    assert.equal(result.requestedCourts, 1)
    assert.equal(result.synced, 1)

    const sourceRecord = await SourceRecord.query()
      .where('tenant_id', tenant.id)
      .where('source', 'datajud')
      .firstOrFail()
    const judicialProcess = await JudicialProcess.query()
      .where('tenant_id', tenant.id)
      .where('cnj_number', '0702042-05.2020.8.07.0003')
      .firstOrFail()

    assert.equal(judicialProcess.assetId, asset.id)
    assert.equal(judicialProcess.sourceRecordId, sourceRecord.id)
    assert.equal(judicialProcess.courtCode, 'TJDFT')
    assert.equal(judicialProcess.courtName, '3a VARA CIVEL DE CEILANDIA')
    assert.equal(judicialProcess.className, 'Procedimento Comum Cível')
    assert.equal(judicialProcess.subject, 'Direito Autoral')
    assert.equal(judicialProcess.filedAt?.toISODate(), '2020-01-28')

    const secondRun = await dataJudPublicApiAdapter.syncByCnj({
      tenantId: tenant.id,
      cnjNumber: '0702042-05.2020.8.07.0003',
      courtAliases: ['tjdft'],
      apiKey: 'test-key',
      fetcher: fakeDataJudFetch([], [dataJudResponse([DATAJUD_HIT])]),
    })

    assert.equal(secondRun.processes[0].created, false)
    assert.equal(await countJudicialProcesses(tenant.id), 1)

    await cleanupTenantData(tenant)
  })
})

type CapturedRequest = {
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
}

function fakeDataJudFetch(requests: CapturedRequest[], responses: Record<string, unknown>[]) {
  let index = 0

  return async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(input),
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body ?? '{}')),
    })

    return new Response(JSON.stringify(responses[index++] ?? dataJudResponse([])), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}

function dataJudResponse(hits: unknown[]) {
  return {
    took: 228,
    timed_out: false,
    _shards: { total: 3, successful: 3, skipped: 0, failed: 0 },
    hits: {
      total: { value: hits.length, relation: 'eq' },
      max_score: null,
      hits,
    },
  }
}

async function cleanupTenantData(tenant: Tenant) {
  await tenant.delete()
}

async function countJudicialProcesses(tenantId: string) {
  const [result] = await JudicialProcess.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}
