import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import Tenant from '#modules/tenant/models/tenant'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import MonitoredBarRegistration from '#modules/legal_publications/models/monitored_bar_registration'
import LegalPublication from '#modules/legal_publications/models/legal_publication'

export type ClientPartySide = 'plaintiff' | 'defendant'

export default class MonitoredCase extends TenantModel {
  @column()
  declare judicialProcessId: string | null

  @column()
  declare monitoredBarRegistrationId: string | null

  @column()
  declare cnjNumber: string

  @column()
  declare label: string | null

  @column()
  declare clientPartySide: ClientPartySide | null

  @column()
  declare active: boolean

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => JudicialProcess)
  declare judicialProcess: BelongsTo<typeof JudicialProcess>

  @belongsTo(() => MonitoredBarRegistration)
  declare monitoredBarRegistration: BelongsTo<typeof MonitoredBarRegistration>

  @hasMany(() => LegalPublication)
  declare legalPublications: HasMany<typeof LegalPublication>
}
