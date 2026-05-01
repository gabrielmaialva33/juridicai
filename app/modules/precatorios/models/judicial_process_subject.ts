import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { JsonRecord } from '#shared/types/model_enums'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import SourceRecord from '#modules/siop/models/source_record'
import Tenant from '#modules/tenant/models/tenant'
import JudicialSubjectCatalog from '#modules/reference/models/judicial_subject_catalog'

export default class JudicialProcessSubject extends TenantModel {
  @column()
  declare processId: string

  @column()
  declare sourceRecordId: string | null

  @column()
  declare subjectCatalogId: string | null

  @column()
  declare subjectCode: number | null

  @column()
  declare subjectName: string

  @column()
  declare sequence: number | null

  @column()
  declare rawData: JsonRecord | null

  @column()
  declare idempotencyKey: string

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => JudicialProcess, {
    foreignKey: 'processId',
  })
  declare process: BelongsTo<typeof JudicialProcess>

  @belongsTo(() => SourceRecord)
  declare sourceRecord: BelongsTo<typeof SourceRecord>

  @belongsTo(() => JudicialSubjectCatalog, {
    foreignKey: 'subjectCatalogId',
  })
  declare subjectCatalog: BelongsTo<typeof JudicialSubjectCatalog>
}
