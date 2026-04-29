import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { JobRunOrigin, JobRunStatus, JsonRecord } from '#shared/types/model_enums'
import Tenant from '#modules/tenant/models/tenant'

export default class RadarJobRun extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare tenantId: string | null

  @column()
  declare jobName: string

  @column()
  declare queueName: string | null

  @column()
  declare bullmqJobId: string | null

  @column()
  declare status: JobRunStatus

  @column()
  declare origin: JobRunOrigin

  @column.dateTime()
  declare startedAt: DateTime | null

  @column.dateTime()
  declare finishedAt: DateTime | null

  @column()
  declare durationMs: number | null

  @column()
  declare attempts: number

  @column()
  declare metrics: JsonRecord | null

  @column()
  declare errorCode: string | null

  @column()
  declare errorMessage: string | null

  @column()
  declare metadata: JsonRecord | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>
}
