import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class MovementComplementType extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare code: number

  @column()
  declare value: number | null

  @column()
  declare name: string | null

  @column()
  declare description: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
