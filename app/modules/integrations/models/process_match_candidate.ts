import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SourceRecord from '#modules/siop/models/source_record'
import Tenant from '#modules/tenant/models/tenant'

export type ProcessMatchCandidateStatus = 'candidate' | 'accepted' | 'rejected' | 'ambiguous'

export default class ProcessMatchCandidate extends TenantModel {
  @column()
  declare assetId: string

  @column()
  declare sourceRecordId: string | null

  @column()
  declare source: SourceType

  @column()
  declare courtAlias: string

  @column()
  declare candidateCnj: string

  @column()
  declare candidateDatajudId: string

  @column()
  declare candidateIndex: string

  @column()
  declare score: number

  @column()
  declare status: ProcessMatchCandidateStatus

  @column()
  declare signals: JsonRecord

  @column()
  declare rawData: JsonRecord

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => PrecatorioAsset, {
    foreignKey: 'assetId',
  })
  declare asset: BelongsTo<typeof PrecatorioAsset>

  @belongsTo(() => SourceRecord)
  declare sourceRecord: BelongsTo<typeof SourceRecord>
}
