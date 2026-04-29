import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { JsonRecord } from '#shared/types/model_enums'

export default class WorkerHeartbeat extends BaseModel {
  @column({ isPrimary: true })
  declare workerId: string

  @column()
  declare queueName: string

  @column()
  declare hostname: string | null

  @column()
  declare pid: number | null

  @column()
  declare metadata: JsonRecord | null

  @column.dateTime({ autoCreate: true })
  declare checkedAt: DateTime
}
