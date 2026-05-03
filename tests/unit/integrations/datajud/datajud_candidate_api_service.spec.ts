import { test } from '@japa/runner'
import dataJudCandidateApiService, {
  serializeDataJudCandidate,
} from '#modules/integrations/services/datajud_candidate_api_service'
import { ProcessMatchCandidateFactory } from '#database/factories/process_match_candidate_factory'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { TenantFactory } from '#database/factories/tenant_factory'

test.group('DataJud candidate API service', () => {
  test('lists tenant-scoped candidates with filters and compact serialization', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const otherTenant = await TenantFactory.create()
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'tribunal',
      cnjNumber: '5004648-37.2022.4.02.9388',
      exerciseYear: 2022,
    }).create()
    await ProcessMatchCandidateFactory.merge({
      tenantId: tenant.id,
      assetId: asset.id,
      source: 'datajud',
      candidateCnj: '5004648-91.2022.4.02.5005',
      candidateDatajudId: 'TRF2_JE_50046489120224025005',
      score: 90,
      status: 'candidate',
    }).create()
    await ProcessMatchCandidateFactory.merge({
      tenantId: otherTenant.id,
      source: 'datajud',
      candidateCnj: '5004648-77.2021.4.02.5118',
      candidateDatajudId: 'TRF2_JE_50046487720214025118',
      score: 95,
      status: 'candidate',
    }).create()

    const candidates = await dataJudCandidateApiService.list(tenant.id, {
      page: 1,
      limit: 10,
      status: 'candidate',
      assetId: asset.id,
      source: 'datajud',
      minScore: 85,
      maxScore: null,
      q: '5004648-91',
      sortBy: 'score',
      sortDirection: 'desc',
    })
    const [candidate] = candidates.all()
    const serialized = serializeDataJudCandidate(candidate)

    assert.lengthOf(candidates.all(), 1)
    assert.equal(serialized.candidateCnj, '5004648-91.2022.4.02.5005')
    assert.equal(serialized.asset?.id, asset.id)
    assert.notProperty(serialized, 'rawData')

    await tenant.delete()
    await otherTenant.delete()
  })

  test('loads a detailed candidate only inside the active tenant', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const otherTenant = await TenantFactory.create()
    const candidate = await ProcessMatchCandidateFactory.merge({ tenantId: tenant.id }).create()

    const detailed = await dataJudCandidateApiService.show(tenant.id, candidate.id)
    const serialized = serializeDataJudCandidate(detailed, { includeRawData: true })

    assert.equal(serialized.id, candidate.id)
    assert.property(serialized, 'rawData')
    await assert.rejects(() => dataJudCandidateApiService.show(otherTenant.id, candidate.id))

    await tenant.delete()
    await otherTenant.delete()
  })
})
