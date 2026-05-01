import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import dataJudCandidateReviewService, {
  DataJudCandidateReviewError,
} from '#modules/integrations/services/datajud_candidate_review_service'
import ProcessMatchCandidate from '#modules/integrations/models/process_match_candidate'
import AssetEvent from '#modules/precatorios/models/asset_event'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

test.group('DataJud candidate review service', () => {
  test('accepts a high-score candidate and promotes it to a judicial process', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'tribunal',
      cnjNumber: '5004648-37.2022.4.02.9388',
    }).create()
    const accepted = await createCandidate(tenant, asset.id, {
      candidateCnj: '5004648-91.2022.4.02.5005',
      score: 90,
    })
    const competing = await createCandidate(tenant, asset.id, {
      candidateCnj: '5004648-77.2021.4.02.5118',
      score: 65,
    })

    const result = await dataJudCandidateReviewService.accept(accepted.id, {
      userId: '11111111-1111-4111-8111-111111111111',
      requestId: 'review-request-1',
    })

    assert.equal(result.candidate.status, 'accepted')
    assert.equal(result.judicialProcess.assetId, asset.id)
    assert.equal(result.judicialProcess.cnjNumber, '5004648-91.2022.4.02.5005')
    assert.equal(result.judicialProcess.source, 'datajud')
    assert.equal(
      result.judicialProcess.className,
      'Cumprimento de Sentença contra a Fazenda Pública'
    )
    const rejectedCompeting = await ProcessMatchCandidate.findOrFail(competing.id)
    assert.equal(rejectedCompeting.status, 'rejected')
    const event = await findEvent(tenant.id, 'datajud_candidate_accepted')
    assert.equal(event?.payload?.reviewedByUserId, '11111111-1111-4111-8111-111111111111')
    assert.equal(event?.payload?.requestId, 'review-request-1')
    assert.equal(await countAuditLogs(tenant.id, 'datajud_candidate_accepted'), 1)

    await cleanupTenantData(tenant)
  })

  test('blocks low-score acceptance unless forced', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'tribunal',
      cnjNumber: '5004648-37.2022.4.02.9388',
    }).create()
    const candidate = await createCandidate(tenant, asset.id, {
      candidateCnj: '5004648-80.2025.4.02.5104',
      score: 50,
    })

    await assert.rejects(
      () => dataJudCandidateReviewService.accept(candidate.id),
      DataJudCandidateReviewError
    )

    const forced = await dataJudCandidateReviewService.accept(candidate.id, { force: true })
    assert.equal(forced.candidate.status, 'accepted')
    assert.equal(await countJudicialProcesses(tenant.id), 1)

    await cleanupTenantData(tenant)
  })

  test('rejects a candidate without creating a judicial process', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'tribunal',
      cnjNumber: '5004648-37.2022.4.02.9388',
    }).create()
    const candidate = await createCandidate(tenant, asset.id, {
      candidateCnj: '5004648-77.2021.4.02.5118',
      score: 65,
    })

    const rejected = await dataJudCandidateReviewService.reject(candidate.id, {
      userId: '22222222-2222-4222-8222-222222222222',
      requestId: 'review-request-2',
    })

    assert.equal(rejected.status, 'rejected')
    assert.equal(await countJudicialProcesses(tenant.id), 0)
    const event = await findEvent(tenant.id, 'datajud_candidate_rejected')
    assert.equal(event?.payload?.reviewedByUserId, '22222222-2222-4222-8222-222222222222')
    assert.equal(event?.payload?.requestId, 'review-request-2')
    assert.equal(await countAuditLogs(tenant.id, 'datajud_candidate_rejected'), 1)

    await cleanupTenantData(tenant)
  })

  test('marks a candidate as ambiguous within the tenant review scope', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const otherTenant = await TenantFactory.create()
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'tribunal',
      cnjNumber: '5004648-37.2022.4.02.9388',
    }).create()
    const candidate = await createCandidate(tenant, asset.id, {
      candidateCnj: '5004648-77.2021.4.02.5118',
      score: 65,
    })

    await assert.rejects(() =>
      dataJudCandidateReviewService.markAmbiguous(candidate.id, { tenantId: otherTenant.id })
    )
    const ambiguous = await dataJudCandidateReviewService.markAmbiguous(candidate.id, {
      tenantId: tenant.id,
      userId: '33333333-3333-4333-8333-333333333333',
      requestId: 'review-request-3',
    })

    assert.equal(ambiguous.status, 'ambiguous')
    const event = await findEvent(tenant.id, 'datajud_candidate_marked_ambiguous')
    assert.equal(event?.payload?.reviewedByUserId, '33333333-3333-4333-8333-333333333333')
    assert.equal(event?.payload?.requestId, 'review-request-3')
    assert.equal(await countAuditLogs(tenant.id, 'datajud_candidate_marked_ambiguous'), 1)

    await cleanupTenantData(tenant)
    await cleanupTenantData(otherTenant)
  })
})

async function createCandidate(
  tenant: Tenant,
  assetId: string,
  input: { candidateCnj: string; score: number }
) {
  const digits = input.candidateCnj.replace(/\D/g, '')

  return ProcessMatchCandidate.create({
    tenantId: tenant.id,
    assetId,
    source: 'datajud',
    courtAlias: 'trf2',
    candidateCnj: input.candidateCnj,
    candidateDatajudId: `TRF2_JE_${digits}`,
    candidateIndex: 'api_publica_trf2',
    score: input.score,
    status: input.score >= 85 ? 'candidate' : 'ambiguous',
    signals: {
      prefix: 35,
      sameYear: 20,
      sameSegmentCourt: 15,
      executionClass: input.score >= 65 ? 15 : 0,
    },
    rawData: {
      datajudId: `TRF2_JE_${digits}`,
      index: 'api_publica_trf2',
      source: {
        numeroProcesso: digits,
        tribunal: 'TRF2',
        classe: {
          codigo: 12078,
          nome: 'Cumprimento de Sentença contra a Fazenda Pública',
        },
        orgaoJulgador: {
          codigo: 12658,
          nome: 'Vara Federal de Colatina',
        },
        assuntos: [{ codigo: 6096, nome: 'Aposentadoria por Idade' }],
        dataAjuizamento: '20221230134016',
      },
    },
  })
}

async function countJudicialProcesses(tenantId: string) {
  const [result] = await JudicialProcess.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}

function findEvent(tenantId: string, eventType: string) {
  return AssetEvent.query().where('tenant_id', tenantId).where('event_type', eventType).first()
}

async function countAuditLogs(tenantId: string, event: string) {
  const [result] = await db
    .from('audit_logs')
    .where('tenant_id', tenantId)
    .where('event', event)
    .count('* as total')

  return Number(result.total)
}

async function cleanupTenantData(tenant: Tenant) {
  await tenant.delete()
}
