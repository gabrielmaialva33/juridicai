import referenceCatalogRepository from '#modules/reference/repositories/reference_catalog_repository'

class ReferenceCatalogService {
  court(input: { code: string | null; alias?: string | null; name?: string | null }) {
    if (!input.code || !input.name) {
      return null
    }

    return referenceCatalogRepository.upsertCourt({
      code: input.code,
      alias: input.alias ?? null,
      name: input.name,
    })
  }

  judicialSystem(input: { code: number | null; name: string | null }) {
    if (input.code === null || !input.name) {
      return null
    }

    return referenceCatalogRepository.upsertJudicialSystem({ code: input.code, name: input.name })
  }

  processFormat(input: { code: number | null; name: string | null }) {
    if (input.code === null || !input.name) {
      return null
    }

    return referenceCatalogRepository.upsertProcessFormat({ code: input.code, name: input.name })
  }

  judicialClass(input: { code: number | null; name: string | null }) {
    if (input.code === null || !input.name) {
      return null
    }

    return referenceCatalogRepository.upsertJudicialClass({ code: input.code, name: input.name })
  }

  movementType(input: { code: number | null; name: string | null }) {
    if (input.code === null || !input.name) {
      return null
    }

    return referenceCatalogRepository.upsertMovementType({ code: input.code, name: input.name })
  }

  subject(input: { code: number | null; name: string | null }) {
    if (input.code === null || !input.name) {
      return null
    }

    return referenceCatalogRepository.upsertSubject({ code: input.code, name: input.name })
  }

  complementType(input: {
    code: number | null
    value: number | null
    name: string | null
    description: string | null
  }) {
    if (input.code === null) {
      return null
    }

    return referenceCatalogRepository.upsertComplementType({
      code: input.code,
      value: input.value,
      name: input.name,
      description: input.description,
    })
  }

  async judgingBody(input: {
    courtId: string | null
    code: string | null
    name: string | null
    municipalityIbgeCode: number | null
  }) {
    if (!input.code || !input.name) {
      return null
    }

    return referenceCatalogRepository.upsertJudgingBody({
      courtId: input.courtId,
      code: input.code,
      name: input.name,
      municipalityIbgeCode: input.municipalityIbgeCode,
    })
  }
}

export const referenceCatalogService = new ReferenceCatalogService()
export default referenceCatalogService
