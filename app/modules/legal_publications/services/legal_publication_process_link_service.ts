import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'
import type { JsonRecord } from '#shared/types/model_enums'
import type JudicialProcess from '#modules/precatorios/models/judicial_process'
import legalPublicationProcessLinkRepository from '#modules/legal_publications/repositories/legal_publication_process_link_repository'

export type LegalPublicationProcessLinkInput = {
  tenantId: string
  processNumber: string | null
  courtAlias?: string | null
  rawData?: JsonRecord | null
}

export type LegalPublicationProcessLink = {
  judicialProcess: JudicialProcess | null
  precatorioAssetId: string | null
  normalizedCnj: string | null
}

class LegalPublicationProcessLinkService {
  async resolve(input: LegalPublicationProcessLinkInput): Promise<LegalPublicationProcessLink> {
    const normalizedCnj = normalizeCnj(input.processNumber ?? '')

    if (!normalizedCnj) {
      return {
        judicialProcess: null,
        precatorioAssetId: null,
        normalizedCnj: null,
      }
    }

    const existing = await legalPublicationProcessLinkRepository.findProcessByCnj(
      input.tenantId,
      normalizedCnj
    )

    if (existing) {
      const changed =
        (!existing.courtAlias && input.courtAlias) ||
        (input.rawData && !existing.rawData?.legalPublication)

      if (changed) {
        await legalPublicationProcessLinkRepository.updateProcessMetadata(existing, {
          courtAlias: input.courtAlias ?? null,
          rawData: input.rawData ?? null,
        })
      }

      return {
        judicialProcess: existing,
        precatorioAssetId: existing.assetId,
        normalizedCnj,
      }
    }

    const asset = await legalPublicationProcessLinkRepository.findAssetByCnj(
      input.tenantId,
      normalizedCnj
    )

    const judicialProcess = await legalPublicationProcessLinkRepository.createProcess(
      input.tenantId,
      {
        cnjNumber: normalizedCnj,
        assetId: asset?.id ?? null,
        courtAlias: input.courtAlias ?? null,
        rawData: input.rawData ?? null,
      }
    )

    return {
      judicialProcess,
      precatorioAssetId: asset?.id ?? null,
      normalizedCnj,
    }
  }
}

export default new LegalPublicationProcessLinkService()
