import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class JudicialSubjectCatalog extends BaseModel {
  static table = 'judicial_subjects_catalog'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare code: number

  @column()
  declare name: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
