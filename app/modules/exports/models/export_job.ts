import { DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { ExportStatus, JsonRecord } from '#shared/types/model_enums'
import Tenant from '#modules/tenant/models/tenant'
import User from '#modules/auth/models/user'

export default class ExportJob extends TenantModel {
  @column()
  declare requestedByUserId: string | null

  @column()
  declare status: ExportStatus

  @column()
  declare exportType: string

  @column()
  declare filters: JsonRecord | null

  @column()
  declare filePath: string | null

  @column()
  declare errorMessage: string | null

  @column.dateTime()
  declare expiresAt: DateTime | null

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => User, {
    foreignKey: 'requestedByUserId',
  })
  declare requestedBy: BelongsTo<typeof User>
}
