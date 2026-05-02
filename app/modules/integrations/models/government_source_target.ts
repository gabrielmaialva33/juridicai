import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import SourceDataset from '#modules/integrations/models/source_dataset'
import type {
  FederativeLevel,
  GovernmentSourceTargetCadence,
  GovernmentSourceTargetStatus,
  JsonRecord,
  SourceDatasetPriority,
  SourceType,
} from '#shared/types/model_enums'

export default class GovernmentSourceTarget extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare sourceDatasetId: string

  @column()
  declare key: string

  @column()
  declare name: string

  @column()
  declare source: SourceType

  @column()
  declare federativeLevel: FederativeLevel

  @column()
  declare stateCode: string | null

  @column()
  declare courtAlias: string | null

  @column()
  declare branch: string

  @column()
  declare priority: SourceDatasetPriority

  @column()
  declare adapterKey: string | null

  @column()
  declare sourceUrl: string | null

  @column()
  declare sourceFormat: string | null

  @column()
  declare status: GovernmentSourceTargetStatus

  @column()
  declare cadence: GovernmentSourceTargetCadence

  @column()
  declare isActive: boolean

  @column.dateTime()
  declare lastSuccessAt: DateTime | null

  @column.dateTime()
  declare lastErrorAt: DateTime | null

  @column()
  declare lastErrorMessage: string | null

  @column()
  declare lastDiscoveredCount: number

  @column()
  declare lastSourceRecordsCount: number

  @column()
  declare coverageScore: string

  @column()
  declare metadata: JsonRecord | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => SourceDataset)
  declare sourceDataset: BelongsTo<typeof SourceDataset>
}
