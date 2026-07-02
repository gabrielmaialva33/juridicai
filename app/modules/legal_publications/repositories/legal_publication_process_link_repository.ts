import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import type { JsonRecord } from '#shared/types/model_enums'

class LegalPublicationProcessLinkRepository {
  findProcessByCnj(tenantId: string, cnjNumber: string) {
    return JudicialProcess.query()
      .where('tenant_id', tenantId)
      .where('cnj_number', cnjNumber)
      .first()
  }

  async updateProcessMetadata(
    process: JudicialProcess,
    input: {
      courtAlias?: string | null
      rawData?: JsonRecord | null
    }
  ) {
    process.merge({
      courtAlias: process.courtAlias ?? input.courtAlias ?? null,
      rawData: {
        ...(process.rawData ?? {}),
        legalPublication: input.rawData ?? process.rawData?.legalPublication ?? null,
      },
    })
    await process.save()
    return process
  }

  findAssetByCnj(tenantId: string, cnjNumber: string) {
    return PrecatorioAsset.query()
      .where('tenant_id', tenantId)
      .where('cnj_number', cnjNumber)
      .first()
  }

  createProcess(
    tenantId: string,
    input: {
      cnjNumber: string
      assetId?: string | null
      courtAlias?: string | null
      rawData?: JsonRecord | null
    }
  ) {
    return JudicialProcess.create({
      tenantId,
      assetId: input.assetId ?? null,
      source: 'djen',
      cnjNumber: input.cnjNumber,
      courtAlias: input.courtAlias ?? null,
      rawData: {
        legalPublication: input.rawData ?? null,
      },
    })
  }
}

export default new LegalPublicationProcessLinkRepository()
