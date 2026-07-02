import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import Tenant from '#modules/tenant/models/tenant'
import User from '#modules/auth/models/user'
import MonitoredCase from '#modules/legal_publications/models/monitored_case'
import LegalPublication from '#modules/legal_publications/models/legal_publication'

export default class MonitoredBarRegistration extends TenantModel {
  @column()
  declare barNumber: string

  @column()
  declare stateCode: string

  @column()
  declare lawyerName: string | null

  @column()
  declare userId: string | null

  @column()
  declare active: boolean

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => MonitoredCase)
  declare monitoredCases: HasMany<typeof MonitoredCase>

  @hasMany(() => LegalPublication)
  declare legalPublications: HasMany<typeof LegalPublication>
}
