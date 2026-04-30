import { test } from '@japa/runner'
import dataJudCandidateMatchService from '#modules/integrations/services/datajud_candidate_match_service'
import ProcessMatchCandidate from '#modules/integrations/models/process_match_candidate'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

test.group('DataJud candidate match service', () => {
  test('scores and persists DataJud candidates without promoting official links', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'tribunal',
      cnjNumber: '5004648-37.2022.4.02.9388',
      exerciseYear: 2024,
    }).create()

    const result = await dataJudCandidateMatchService.match({
      tenantId: tenant.id,
      source: 'tribunal',
      limit: 1,
      candidatesPerAsset: 2,
      persist: true,
      apiKey: 'test-key',
      fetcher: fakeDataJudFetch,
    })

    assert.include(result.stats, {
      selected: 1,
      attempted: 1,
      candidates: 2,
      upserted: 2,
      errors: 0,
    })
    assert.isAbove(result.matches[0].score, result.matches[1].score)
    assert.equal(result.matches[0].candidateCnj, '5004648-91.2022.4.02.5005')

    const persisted = await ProcessMatchCandidate.query()
      .where('tenant_id', tenant.id)
      .orderBy('score', 'desc')

    assert.lengthOf(persisted, 2)
    assert.equal(persisted[0].assetId, asset.id)
    assert.equal(persisted[0].candidateCnj, '5004648-91.2022.4.02.5005')
    assert.equal(persisted[0].status, 'candidate')

    const secondRun = await dataJudCandidateMatchService.match({
      tenantId: tenant.id,
      source: 'tribunal',
      limit: 1,
      candidatesPerAsset: 2,
      persist: true,
      apiKey: 'test-key',
      fetcher: fakeDataJudFetch,
    })

    assert.equal(secondRun.stats.upserted, 2)
    assert.equal(await countCandidates(tenant.id), 2)

    await cleanupTenantData(tenant)
  })

  test('supports dry-run candidate matching without persistence', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'tribunal',
      cnjNumber: '5004648-37.2022.4.02.9388',
      exerciseYear: 2024,
    }).create()

    const result = await dataJudCandidateMatchService.match({
      tenantId: tenant.id,
      source: 'tribunal',
      limit: 1,
      persist: false,
      apiKey: 'test-key',
      fetcher: fakeDataJudFetch,
    })

    assert.equal(result.stats.candidates, 2)
    assert.equal(result.stats.upserted, 0)
    assert.equal(await countCandidates(tenant.id), 0)

    await cleanupTenantData(tenant)
  })
})

async function fakeDataJudFetch(_input: string | URL | Request, init?: RequestInit) {
  const body = JSON.parse(String(init?.body ?? '{}'))

  return new Response(JSON.stringify(dataJudResponse(body.size ?? 2)), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function dataJudResponse(size: number) {
  const hits = [
    dataJudHit('50046489120224025005', 'Cumprimento de Sentença contra a Fazenda Pública'),
    dataJudHit('50046488020254025104', 'Procedimento do Juizado Especial Cível'),
  ].slice(0, size)

  return {
    took: 10,
    timed_out: false,
    hits: {
      total: { value: hits.length, relation: 'eq' },
      hits,
    },
  }
}

function dataJudHit(numeroProcesso: string, className: string) {
  return {
    _index: 'api_publica_trf2',
    _id: `TRF2_JE_${numeroProcesso}`,
    _source: {
      numeroProcesso,
      tribunal: 'TRF2',
      dataAjuizamento: '20221230134016',
      classe: { codigo: 12078, nome: className },
      orgaoJulgador: { codigo: 12658, nome: 'Vara Federal de Colatina' },
      assuntos: [{ codigo: 6096, nome: 'Aposentadoria por Idade' }],
    },
  }
}

async function countCandidates(tenantId: string) {
  const [result] = await ProcessMatchCandidate.query()
    .where('tenant_id', tenantId)
    .count('* as total')
  return Number(result.$extras.total)
}

async function cleanupTenantData(tenant: Tenant) {
  await tenant.delete()
}
