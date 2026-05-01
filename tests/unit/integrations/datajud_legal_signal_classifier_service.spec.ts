import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import dataJudLegalSignalClassifierService from '#modules/integrations/services/datajud_legal_signal_classifier_service'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetScore from '#modules/precatorios/models/asset_score'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import JudicialProcessMovement from '#modules/precatorios/models/judicial_process_movement'
import JudicialProcessMovementComplement from '#modules/precatorios/models/judicial_process_movement_complement'
import JudicialProcessSignal from '#modules/precatorios/models/judicial_process_signal'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

test.group('DataJud legal signal classifier service', () => {
  test('classifies normalized movements and projects asset events idempotently', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      cnjNumber: '1006611-83.2024.8.26.0624',
    }).create()
    const process = await JudicialProcess.create({
      tenantId: tenant.id,
      assetId: asset.id,
      sourceRecordId: null,
      source: 'datajud',
      cnjNumber: asset.cnjNumber!,
      courtAlias: 'tjsp',
      filedAt: DateTime.fromISO('2024-01-10'),
      rawData: {},
    })
    await JudicialProcessMovement.create({
      tenantId: tenant.id,
      processId: process.id,
      sourceRecordId: null,
      source: 'datajud',
      movementCode: 12457,
      movementName: 'Expedição de precatório/rpv',
      occurredAt: DateTime.fromISO('2025-04-04T13:22:17.000Z'),
      sequence: 1,
      rawData: {
        codigo: 12457,
        nome: 'Expedição de precatório/rpv',
      },
      idempotencyKey: 'movement-requisition',
    })
    const lienMovement = await JudicialProcessMovement.create({
      tenantId: tenant.id,
      processId: process.id,
      sourceRecordId: null,
      source: 'datajud',
      movementCode: 60,
      movementName: 'Expedição de documento',
      occurredAt: DateTime.fromISO('2025-05-01T10:00:00.000Z'),
      sequence: 2,
      rawData: {
        texto: 'Certidão de penhora no rosto dos autos',
      },
      idempotencyKey: 'movement-lien',
    })

    await JudicialProcessMovementComplement.create({
      tenantId: tenant.id,
      movementId: lienMovement.id,
      sourceRecordId: null,
      complementCode: 4,
      complementValue: 107,
      complementName: 'Certidão de penhora',
      complementDescription: 'tipo_de_documento',
      sequence: 1,
      rawData: {},
      idempotencyKey: 'movement-lien-complement',
    })

    const metrics = await dataJudLegalSignalClassifierService.classify({
      tenantId: tenant.id,
      limit: 20,
    })

    assert.equal(metrics.selectedMovements, 2)
    assert.equal(metrics.matchedSignals, 2)
    assert.equal(metrics.processSignalsUpserted, 2)
    assert.equal(metrics.assetEventsUpserted, 2)
    assert.equal(metrics.assetScoresRefreshed, 1)
    assert.equal(metrics.assetScoresCreated, 1)

    const signals = await JudicialProcessSignal.query()
      .where('tenant_id', tenant.id)
      .orderBy('signal_code', 'asc')
    const events = await AssetEvent.query()
      .where('tenant_id', tenant.id)
      .orderBy('event_type', 'asc')

    assert.deepEqual(
      signals.map((signal) => signal.signalCode),
      ['lien_detected', 'requisition_issued']
    )
    assert.deepEqual(
      events.map((event) => event.eventType),
      ['lien_detected', 'requisition_issued']
    )
    await asset.refresh()
    assert.isNotNull(asset.currentScoreId)
    assert.isAtLeast(asset.currentScore ?? 0, 1)

    const secondRun = await dataJudLegalSignalClassifierService.classify({
      tenantId: tenant.id,
      limit: 20,
    })

    assert.equal(secondRun.processSignalsUpserted, 2)
    assert.equal(secondRun.assetEventsUpserted, 2)
    assert.equal(secondRun.assetScoresRefreshed, 1)
    assert.equal(secondRun.assetScoresCreated, 0)
    assert.equal(await countSignals(tenant.id), 2)
    assert.equal(await countAssetEvents(tenant.id), 2)
    assert.equal(await countAssetScores(tenant.id), 1)

    await cleanupTenantData(tenant)
  })
})

async function countSignals(tenantId: string) {
  const [result] = await JudicialProcessSignal.query()
    .where('tenant_id', tenantId)
    .count('* as total')
  return Number(result.$extras.total)
}

async function countAssetEvents(tenantId: string) {
  const [result] = await AssetEvent.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}

async function countAssetScores(tenantId: string) {
  const [result] = await AssetScore.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}

async function cleanupTenantData(tenant: Tenant) {
  await tenant.delete()
}
