import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { JsonRecord, StagingValidationStatus } from '#shared/types/model_enums'
import SiopImport from '#modules/siop/models/siop_import'

export default class SiopStagingRow extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare importId: string

  @column()
  declare rawData: JsonRecord

  @column()
  declare normalizedCnj: string | null

  @column()
  declare normalizedDebtorKey: string | null

  @column()
  declare normalizedValue: string | null

  @column()
  declare normalizedYear: number | null

  @column()
  declare validationStatus: StagingValidationStatus

  @column()
  declare errors: JsonRecord | null

  @column.dateTime()
  declare processedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => SiopImport, {
    foreignKey: 'importId',
  })
  declare siopImport: BelongsTo<typeof SiopImport>
}
