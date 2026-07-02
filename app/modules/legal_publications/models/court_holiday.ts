import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, column } from '@adonisjs/lucid/orm'

export type CourtHolidayScope = 'national' | 'court'

export default class CourtHoliday extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare scope: CourtHolidayScope

  @column()
  declare courtAlias: string | null

  @column.date()
  declare date: DateTime

  @column()
  declare description: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @beforeCreate()
  static assignUuid(model: CourtHoliday) {
    if (!model.id) {
      model.id = randomUUID()
    }
  }
}
