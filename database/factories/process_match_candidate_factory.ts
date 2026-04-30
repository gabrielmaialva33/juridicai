import factory from '@adonisjs/lucid/factories'
import ProcessMatchCandidate from '#modules/integrations/models/process_match_candidate'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { ensureTenantId } from '#database/factories/factory_helpers'

export const ProcessMatchCandidateFactory = factory
  .define(ProcessMatchCandidate, ({ faker }) => {
    const digits = `500${faker.string.numeric(4)}${faker.string.numeric(2)}20224025005`

    return {
      source: 'datajud' as const,
      courtAlias: 'trf2',
      candidateCnj: `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16)}`,
      candidateDatajudId: `TRF2_JE_${digits}`,
      candidateIndex: 'api_publica_trf2',
      score: faker.number.int({ min: 60, max: 95 }),
      status: 'candidate' as const,
      signals: {
        prefix: 35,
        sameYear: 20,
        sameSegmentCourt: 15,
      },
      rawData: {
        datajudId: `TRF2_JE_${digits}`,
        index: 'api_publica_trf2',
        source: {
          numeroProcesso: digits,
          tribunal: 'TRF2',
        },
      },
    }
  })
  .before('create', async (_, row) => {
    const tenantId = await ensureTenantId(row)

    if (!row.assetId) {
      const asset = await PrecatorioAssetFactory.merge({
        tenantId,
        source: 'tribunal',
        cnjNumber: '5004648-37.2022.4.02.9388',
      }).create()
      row.assetId = asset.id
    }
  })
  .build()
