import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { JsonRecord } from '#shared/types/model_enums'
import Tenant from '#modules/tenant/models/tenant'
import User from '#modules/auth/models/user'
import LegalPublication from '#modules/legal_publications/models/legal_publication'

export type LegalPublicationEventType =
  | 'ingested'
  | 'interpreted'
  | 'deadline_calculated'
  | 'confirmed'
  | 'dismissed'
  | 'deadline_edited'
  | 'interpretation_requested'
  | 'interpretation_edited'
  | 'projected_to_asset'

export default class LegalPublicationEvent extends TenantModel {
  @column()
  declare legalPublicationId: string

  @column()
  declare eventType: LegalPublicationEventType

  @column()
  declare payload: JsonRecord | null

  @column()
  declare userId: string | null

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => LegalPublication)
  declare legalPublication: BelongsTo<typeof LegalPublication>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
