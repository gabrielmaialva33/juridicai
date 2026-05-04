import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import assetIntelligenceDossierService from '#modules/operations/services/asset_intelligence_dossier_service'
import AssetFieldEvidence from '#modules/precatorios/models/asset_field_evidence'
import assetFieldEvidenceService from '#modules/precatorios/services/asset_field_evidence_service'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { SourceRecordFactory } from '#database/factories/source_record_factory'
import { TenantFactory } from '#database/factories/tenant_factory'

test.group('asset field evidence service', () => {
  test('materializes canonical field evidence and flags conflicting identifiers', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await SourceRecordFactory.merge({
      tenantId: tenant.id,
      source: 'tribunal',
      rawData: { providerId: 'trf3-chronological-list' },
    }).create()
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      sourceRecordId: sourceRecord.id,
      source: 'tribunal',
      cnjNumber: '0001234-56.2024.4.03.6100',
      assetNumber: 'PRC-2026-1',
      faceValue: '1247892.00',
      estimatedUpdatedValue: '1320000.00',
    }).create()

    await db.table('asset_source_links').insert({
      tenant_id: tenant.id,
      asset_id: asset.id,
      source_record_id: sourceRecord.id,
      link_type: 'primary',
      confidence: '0.9500',
      match_reason: 'tribunal_cnj_match',
      matched_fields: { cnjNumber: asset.cnjNumber },
      normalized_payload: {
        cnjNumber: '0001234-56.2024.4.03.6100',
        assetNumber: 'PRC-2026-1',
        faceValue: '1247892.00',
        estimatedUpdatedValue: '1320000.00',
      },
      raw_pointer: { row: 1 },
    })
    await db.table('external_identifiers').insert({
      tenant_id: tenant.id,
      asset_id: asset.id,
      source_record_id: sourceRecord.id,
      identifier_type: 'cnj_number',
      identifier_value: '9999999-99.2024.4.03.6100',
      normalized_value: '99999999920244036100',
      issuer: 'TRIBUNAL',
      confidence: '0.6000',
      is_primary: false,
      raw_data: {},
    })

    const result = await assetFieldEvidenceService.materialize(tenant.id, asset.id)

    assert.equal(result.totalFields, 15)
    assert.isAtLeast(result.resolvedFields, 4)
    assert.equal(result.conflictFields, 1)

    const cnjEvidence = await AssetFieldEvidence.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .where('field_key', 'cnj_number')
      .firstOrFail()
    const faceValueEvidence = await AssetFieldEvidence.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .where('field_key', 'face_value')
      .firstOrFail()

    assert.equal(cnjEvidence.status, 'conflict')
    assert.equal(cnjEvidence.canonicalValue, '0001234-56.2024.4.03.6100')
    assert.isTrue(
      cnjEvidence.conflictingValues.some((conflict) =>
        String(conflict.normalizedValue).includes('99999999920244036100')
      )
    )
    assert.equal(faceValueEvidence.status, 'resolved')
    assert.equal(faceValueEvidence.canonicalValue, '1247892.00')

    const dossier = await assetIntelligenceDossierService.build(tenant.id, asset.id)

    assert.isTrue(
      dossier.fieldEvidence.some(
        (field) => field.fieldKey === 'cnj_number' && field.status === 'conflict'
      )
    )

    await tenant.delete()
  })
})
