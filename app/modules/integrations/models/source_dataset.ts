import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type {
  FederativeLevel,
  JsonRecord,
  SourceDatasetAccess,
  SourceDatasetKind,
  SourceDatasetPriority,
  SourceType,
} from '#shared/types/model_enums'
import SourceRecord from '#modules/siop/models/source_record'
import CoverageRun from '#modules/integrations/models/coverage_run'

export default class SourceDataset extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare key: string

  @column()
  declare name: string

  @column()
  declare owner: string | null

  @column()
  declare source: SourceType

  @column()
  declare federativeLevel: FederativeLevel

  @column()
  declare kind: SourceDatasetKind

  @column()
  declare access: SourceDatasetAccess

  @column()
  declare priority: SourceDatasetPriority

  @column()
  declare baseUrl: string

  @column()
  declare stateCode: string | null

  @column()
  declare courtAlias: string | null

  @column()
  declare format: string | null

  @column()
  declare notes: string | null

  @column()
  declare metadata: JsonRecord | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => SourceRecord)
  declare sourceRecords: HasMany<typeof SourceRecord>

  @hasMany(() => CoverageRun)
  declare coverageRuns: HasMany<typeof CoverageRun>
}
