import { DateTime } from 'luxon'
import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import TenantBaseModel from '#shared/models/tenant_base_model'
import type {
  AssetNature,
  ComplianceStatus,
  JsonRecord,
  LifecycleStatus,
  PiiStatus,
  SourceType,
} from '#shared/types/model_enums'
import Debtor from '#modules/debtors/models/debtor'
import Tenant from '#modules/tenant/models/tenant'
import SourceRecord from '#modules/siop/models/source_record'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetScore from '#modules/precatorios/models/asset_score'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import Publication from '#modules/precatorios/models/publication'

export default class PrecatorioAsset extends TenantBaseModel {
  @column()
  declare sourceRecordId: string | null

  @column()
  declare source: SourceType

  @column()
  declare externalId: string | null

  @column()
  declare cnjNumber: string | null

  @column()
  declare originProcessNumber: string | null

  @column()
  declare debtorId: string | null

  @column()
  declare assetNumber: string | null

  @column()
  declare exerciseYear: number | null

  @column()
  declare budgetYear: number | null

  @column()
  declare nature: AssetNature

  @column()
  declare faceValue: string | null

  @column()
  declare estimatedUpdatedValue: string | null

  @column.date()
  declare baseDate: DateTime | null

  @column()
  declare queuePosition: number | null

  @column()
  declare lifecycleStatus: LifecycleStatus

  @column()
  declare piiStatus: PiiStatus

  @column()
  declare complianceStatus: ComplianceStatus

  @column()
  declare currentScore: number | null

  @column()
  declare currentScoreId: string | null

  @column()
  declare rawData: JsonRecord | null

  @column()
  declare rowFingerprint: string | null

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => SourceRecord)
  declare sourceRecord: BelongsTo<typeof SourceRecord>

  @belongsTo(() => Debtor)
  declare debtor: BelongsTo<typeof Debtor>

  @belongsTo(() => AssetScore, {
    foreignKey: 'currentScoreId',
  })
  declare currentScoreRow: BelongsTo<typeof AssetScore>

  @hasMany(() => AssetEvent, {
    foreignKey: 'assetId',
  })
  declare events: HasMany<typeof AssetEvent>

  @hasMany(() => AssetScore, {
    foreignKey: 'assetId',
  })
  declare scores: HasMany<typeof AssetScore>

  @hasMany(() => JudicialProcess, {
    foreignKey: 'assetId',
  })
  declare judicialProcesses: HasMany<typeof JudicialProcess>

  @hasMany(() => Publication, {
    foreignKey: 'assetId',
  })
  declare publications: HasMany<typeof Publication>
}
