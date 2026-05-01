import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Court from '#modules/reference/models/court'

export default class JudgingBody extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare courtId: string | null

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare municipalityIbgeCode: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Court)
  declare court: BelongsTo<typeof Court>
}
