import { DateTime } from 'luxon'
import { belongsTo, column, hasMany, hasOne } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'
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
import AssetBudgetFact from '#modules/precatorios/models/asset_budget_fact'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import Publication from '#modules/precatorios/models/publication'
import CessionOpportunity from '#modules/operations/models/cession_opportunity'
import BudgetUnit from '#modules/reference/models/budget_unit'
import Court from '#modules/reference/models/court'

export default class PrecatorioAsset extends TenantBaseModel {
  faceValue: string | null = null
  estimatedUpdatedValue: string | null = null
  baseDate: DateTime | null = null
  queuePosition: number | null = null
  courtCode: string | null = null
  courtName: string | null = null
  courtClass: string | null = null
  budgetUnitCode: string | null = null
  budgetUnitName: string | null = null
  causeType: string | null = null

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
  declare courtId: string | null

  @column()
  declare budgetUnitId: string | null

  @column()
  declare assetNumber: string | null

  @column()
  declare exerciseYear: number | null

  @column()
  declare budgetYear: number | null

  @column()
  declare nature: AssetNature

  @column.date()
  declare originFiledAt: DateTime | null

  @column.date()
  declare autuatedAt: DateTime | null

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

  @belongsTo(() => Court)
  declare court: BelongsTo<typeof Court>

  @belongsTo(() => BudgetUnit)
  declare budgetUnit: BelongsTo<typeof BudgetUnit>

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

  @hasMany(() => AssetBudgetFact, {
    foreignKey: 'assetId',
  })
  declare budgetFacts: HasMany<typeof AssetBudgetFact>

  @hasMany(() => AssetValuation, {
    foreignKey: 'assetId',
  })
  declare valuations: HasMany<typeof AssetValuation>

  @hasMany(() => JudicialProcess, {
    foreignKey: 'assetId',
  })
  declare judicialProcesses: HasMany<typeof JudicialProcess>

  @hasMany(() => Publication, {
    foreignKey: 'assetId',
  })
  declare publications: HasMany<typeof Publication>

  @hasOne(() => CessionOpportunity, {
    foreignKey: 'assetId',
  })
  declare cessionOpportunity: HasOne<typeof CessionOpportunity>
}
