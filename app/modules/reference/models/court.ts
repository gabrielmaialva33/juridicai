import { DateTime } from 'luxon'
import { column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { BaseModel } from '@adonisjs/lucid/orm'
import JudgingBody from '#modules/reference/models/judging_body'

export default class Court extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare code: string

  @column()
  declare alias: string | null

  @column()
  declare name: string

  @column()
  declare courtClass: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => JudgingBody, {
    foreignKey: 'courtId',
  })
  declare judgingBodies: HasMany<typeof JudgingBody>
}
