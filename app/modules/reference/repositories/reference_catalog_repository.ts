import Court from '#modules/reference/models/court'
import JudicialClass from '#modules/reference/models/judicial_class'
import JudicialSubjectCatalog from '#modules/reference/models/judicial_subject_catalog'
import JudicialSystem from '#modules/reference/models/judicial_system'
import JudgingBody from '#modules/reference/models/judging_body'
import MovementComplementType from '#modules/reference/models/movement_complement_type'
import MovementType from '#modules/reference/models/movement_type'
import ProcessFormat from '#modules/reference/models/process_format'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

class ReferenceCatalogRepository {
  upsertCourt(input: { code: string; alias: string | null; name: string }) {
    return Court.updateOrCreate(
      { code: input.code },
      {
        code: input.code,
        alias: input.alias,
        name: input.name,
        courtClass: null,
      }
    )
  }

  async upsertCourtClass(
    input: {
      code: string
      name: string
      courtClass: string | null
    },
    trx: TransactionClientContract
  ) {
    const existing = await Court.query({ client: trx }).where('code', input.code).first()

    if (existing) {
      existing.merge({
        name: input.name,
        courtClass: input.courtClass,
      })
      await existing.save()
      return existing
    }

    return Court.create(
      {
        code: input.code,
        alias: null,
        name: input.name,
        courtClass: input.courtClass,
      },
      { client: trx }
    )
  }

  upsertJudicialSystem(input: { code: number; name: string }) {
    return JudicialSystem.updateOrCreate(
      { code: input.code },
      { code: input.code, name: input.name }
    )
  }

  upsertProcessFormat(input: { code: number; name: string }) {
    return ProcessFormat.updateOrCreate(
      { code: input.code },
      { code: input.code, name: input.name }
    )
  }

  upsertJudicialClass(input: { code: number; name: string }) {
    return JudicialClass.updateOrCreate(
      { code: input.code },
      { code: input.code, name: input.name }
    )
  }

  upsertMovementType(input: { code: number; name: string }) {
    return MovementType.updateOrCreate({ code: input.code }, { code: input.code, name: input.name })
  }

  upsertSubject(input: { code: number; name: string }) {
    return JudicialSubjectCatalog.updateOrCreate(
      { code: input.code },
      { code: input.code, name: input.name }
    )
  }

  upsertComplementType(input: {
    code: number
    value: number | null
    name: string | null
    description: string | null
  }) {
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

  upsertJudgingBody(input: {
    courtId: string | null
    code: string
    name: string
    municipalityIbgeCode: number | null
  }) {
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

export default new ReferenceCatalogRepository()
