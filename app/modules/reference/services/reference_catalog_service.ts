import Court from '#modules/reference/models/court'
import JudicialClass from '#modules/reference/models/judicial_class'
import JudicialSubjectCatalog from '#modules/reference/models/judicial_subject_catalog'
import JudicialSystem from '#modules/reference/models/judicial_system'
import JudgingBody from '#modules/reference/models/judging_body'
import MovementComplementType from '#modules/reference/models/movement_complement_type'
import MovementType from '#modules/reference/models/movement_type'
import ProcessFormat from '#modules/reference/models/process_format'

class ReferenceCatalogService {
  court(input: { code: string | null; alias?: string | null; name?: string | null }) {
    if (!input.code || !input.name) {
      return null
    }

    return Court.updateOrCreate(
      { code: input.code },
      {
        code: input.code,
        alias: input.alias ?? null,
        name: input.name,
        courtClass: null,
      }
    )
  }

  judicialSystem(input: { code: number | null; name: string | null }) {
    if (input.code === null || !input.name) {
      return null
    }

    return JudicialSystem.updateOrCreate(
      { code: input.code },
      { code: input.code, name: input.name }
    )
  }

  processFormat(input: { code: number | null; name: string | null }) {
    if (input.code === null || !input.name) {
      return null
    }

    return ProcessFormat.updateOrCreate(
      { code: input.code },
      { code: input.code, name: input.name }
    )
  }

  judicialClass(input: { code: number | null; name: string | null }) {
    if (input.code === null || !input.name) {
      return null
    }

    return JudicialClass.updateOrCreate(
      { code: input.code },
      { code: input.code, name: input.name }
    )
  }

  movementType(input: { code: number | null; name: string | null }) {
    if (input.code === null || !input.name) {
      return null
    }

    return MovementType.updateOrCreate({ code: input.code }, { code: input.code, name: input.name })
  }

  subject(input: { code: number | null; name: string | null }) {
    if (input.code === null || !input.name) {
      return null
    }

    return JudicialSubjectCatalog.updateOrCreate(
      { code: input.code },
      { code: input.code, name: input.name }
    )
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

    return MovementComplementType.updateOrCreate(
      { code: input.code, value: input.value },
      {
        code: input.code,
        value: input.value,
        name: input.name,
        description: input.description,
      }
    )
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

    return JudgingBody.updateOrCreate(
      { courtId: input.courtId, code: input.code },
      {
        courtId: input.courtId,
        code: input.code,
        name: input.name,
        municipalityIbgeCode: input.municipalityIbgeCode,
      }
    )
  }
}

export const referenceCatalogService = new ReferenceCatalogService()
export default referenceCatalogService
